import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { getD1 } from "@/db";
import { deliverDeletionCode } from "@/lib/campus-email";
import { AccessError } from "@/lib/access-error";

type Row = Record<string, unknown>;
function digest(userId: string, email: string, code: string) {
  const secret = process.env.AUTH_CODE_SECRET || (process.env.NODE_ENV !== "production" ? "tongpin-development-only-secret" : "");
  if (!secret) throw new Error("账号安全服务暂时不可用。");
  return createHmac("sha256", secret).update(`account-delete:${userId}:${email}:${code}`).digest("hex");
}
async function activeAccount(userId: string) {
  const user = await getD1().prepare("SELECT id, email, campus_email FROM users WHERE id = ? AND status = 'active'").bind(userId).first<Row>();
  if (!user || !user.email) throw new AccessError("登录已失效，请重新登录。", 401);
  return user;
}
export async function sendAccountDeletionCode(userId: string) {
  const user = await activeAccount(userId), db = getD1(), channel = `account_delete:${userId}`;
  const latest = await db.prepare("SELECT created_at FROM login_codes WHERE channel = ? ORDER BY id DESC LIMIT 1").bind(channel).first<Row>();
  if (latest && Date.now() - new Date(String(latest.created_at)).getTime() < 60_000) throw new Error("请 60 秒后再获取注销验证码。");
  const recent = await db.prepare("SELECT COUNT(*) AS count FROM login_codes WHERE channel = ? AND created_at > ?").bind(channel, new Date(Date.now() - 3600_000).toISOString()).first<Row>();
  if (Number(recent?.count) >= 5) throw new Error("注销验证码请求较多，请稍后再试。");
  const code = String(randomInt(100000, 1000000)), timestamp = new Date().toISOString(), expiresAt = new Date(Date.now() + 600_000).toISOString();
  const hashed = digest(userId, String(user.email), code);
  const delivery = await deliverDeletionCode(String(user.email), code);
  await db.batch([
    db.prepare("UPDATE login_codes SET consumed_at = ? WHERE channel = ? AND consumed_at IS NULL").bind(timestamp, channel),
    db.prepare("INSERT INTO login_codes(destination,channel,code_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(user.email, channel, hashed, expiresAt, timestamp),
  ]);
  return { ...delivery, expiresAt };
}
export async function deleteOwnAccount(userId: string, code: string, confirmation: string) {
  if (confirmation !== "注销账号") throw new Error("请输入“注销账号”确认本次操作。");
  const user = await activeAccount(userId), db = getD1(), timestamp = new Date().toISOString();
  const proof = await db.prepare("SELECT * FROM login_codes WHERE channel = ? AND destination = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1").bind(`account_delete:${userId}`, user.email).first<Row>();
  if (!proof || String(proof.expires_at) <= timestamp) throw new Error("注销验证码无效或已过期，请重新获取。");
  if (Number(proof.attempts) >= 5) throw new Error("注销验证码尝试次数过多，请重新获取。");
  if (!/^\d{6}$/.test(code) || digest(userId, String(user.email), code) !== proof.code_hash) {
    await db.prepare("UPDATE login_codes SET attempts=attempts+1 WHERE id=? AND attempts < 5 AND consumed_at IS NULL").bind(proof.id).run();
    throw new Error("注销验证码错误。");
  }
  const claimed = await db.prepare("UPDATE login_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND attempts < 5 AND expires_at > ?").bind(timestamp, proof.id, timestamp).run();
  if (claimed.meta.changes !== 1) throw new Error("注销验证码已使用，请重新获取。");
  // Keep an anonymous identity for moderation references; never reuse its ID.
  // All content changes commit together. A failed batch leaves the account intact.
  await db.batch([
    db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM login_codes WHERE destination = ? OR destination = ? OR channel IN (?, ?)").bind(user.email, user.campus_email || "", `campus:${userId}`, `account_delete:${userId}`),
    db.prepare("DELETE FROM verification_codes WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM verification_requests WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM questionnaire_answers WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM avatar_images WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM companion_experiences WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM plaza_likes WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM plaza_comments WHERE author_id = ?").bind(userId),
    db.prepare("UPDATE plaza_posts SET content = '[内容已删除]', status = 'deleted', updated_at = ? WHERE author_id = ?").bind(timestamp, userId),
    db.prepare("DELETE FROM messages WHERE sender_id = ?").bind(userId),
    db.prepare("DELETE FROM match_intents WHERE user_id = ?").bind(userId),
    db.prepare("UPDATE matches SET status = 'closed', shared_points_json = '[]', updated_at = ? WHERE user_a_id = ? OR user_b_id = ?").bind(timestamp, userId, userId),
    db.prepare("UPDATE users SET platform_user_id = ?, email = NULL, campus_email = NULL, display_name = '已注销用户', university = NULL, campus_verified = 0, verification_method = NULL, verification_status = 'unverified', verified_until = NULL, matching_enabled = 0, questionnaire_completed = 0, onboarding_step = 0, role = 'student', status = 'deleted', updated_at = ? WHERE id = ?")
      .bind(`deleted:${userId}`, timestamp, userId),
    db.prepare("INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,detail,created_at) VALUES (?,'account_deleted','user',?,NULL,?)").bind(userId, userId, timestamp),
  ]);
  return { deleted: true, redirectTo: "/" };
}
