import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import sharp from "sharp";
import { getD1 } from "@/db";
import { AccessError } from "@/lib/access-error";
import { isAdminEmail } from "@/lib/admin";
import type { StudentVerificationMethod, VerificationSummary } from "@/lib/student-verification";

type Row = Record<string, unknown>;
type Evidence = { name: string; studentNumber: string; code: string; challenge: string; enrollmentUntil: string; images: string[] };
function secret() {
  const value = process.env.AUTH_CODE_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("认证材料加密服务尚未配置。");
  return value || "tongpin-development-only-secret";
}
function hash(value: string) { return createHmac("sha256", secret()).update(`student-verification-v1:${value}`).digest("hex"); }
function encrypt(evidence: Evidence, userId: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(`evidence-v1:${secret()}`).digest(), iv);
  cipher.setAAD(Buffer.from(userId));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(evidence), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map(value => value.toString("base64")).join(".");
}
function decrypt(value: string, userId: string): Evidence {
  const [iv, tag, bytes] = value.split(".").map(item => Buffer.from(item, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(`evidence-v1:${secret()}`).digest(), iv);
  cipher.setAAD(Buffer.from(userId)); cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString("utf8"));
}
async function requireAdmin(userId: string) {
  const user = await getD1().prepare("SELECT email, status FROM users WHERE id = ?").bind(userId).first<Row>();
  if (user?.status !== "active" || !isAdminEmail(String(user.email || ""))) throw new AccessError("仅管理员可查看或审核认证材料。", 403);
}
export async function purgeVerificationEvidence() {
  const db = getD1(), timestamp = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE users SET verification_status = 'rejected' WHERE campus_verified = 0 AND verification_status = 'pending' AND id IN (SELECT user_id FROM verification_requests WHERE status = 'pending' AND evidence_expires_at <= ?)").bind(timestamp),
    db.prepare("UPDATE verification_requests SET encrypted_evidence = NULL, status = CASE WHEN status = 'pending' THEN 'rejected' ELSE status END, review_note = COALESCE(review_note, '材料已超过 14 天审核期限，请重新提交。') WHERE evidence_expires_at <= ? AND encrypted_evidence IS NOT NULL").bind(timestamp),
  ]);
}
export async function getStudentVerificationState(userId: string) {
  await purgeVerificationEvidence();
  const latest = await getD1().prepare("SELECT id, method, status, university, review_note, created_at, evidence_expires_at FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(userId).first<VerificationSummary>();
  return { latest: latest ? { ...latest } : null };
}
async function encodeImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024) throw new Error("请上传一张不超过 3MB 的学生证照片。");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("凭证照片仅支持 JPG、PNG、WebP。");
  const source = Buffer.from(await file.arrayBuffer());
  const image = sharp(source, { limitInputPixels: 16_000_000, animated: false });
  const meta = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) > 1 || Math.min(meta.width || 0, meta.height || 0) < 300) throw new Error("图片无效或太小，请上传清晰的凭证照片。");
  const bytes = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  if (bytes.length > 400 * 1024) throw new Error("照片内容过大，请裁剪到凭证区域后重新上传。");
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
export async function submitStudentVerification(userId: string, form: FormData) {
  await purgeVerificationEvidence();
  const method = String(form.get("method")) as StudentVerificationMethod;
  if (!["chsi_code", "student_card"].includes(method)) throw new Error("请选择学信网或学生证认证。");
  const school = String(form.get("university") || "").trim().replace(/\s+/g, " ");
  const code = String(form.get("identifier") || "").replace(/\s+/g, "").toUpperCase();
  if (school.length < 2 || school.length > 80) throw new Error("请填写学校的完整名称。");
  if (form.get("consent") !== "true") throw new Error("请先同意仅为本账号学生身份核验使用材料，并确认材料属于本人。");
  if (method === "chsi_code" && !/^(?:[A-Z0-9]{12}|[A-Z0-9]{16})$/.test(code)) throw new Error("请填写学籍在线验证报告的 12 或 16 位在线验证码；不是短信验证码。");
  const db = getD1();
  const pending = await db.prepare("SELECT id FROM verification_requests WHERE user_id = ? AND status = 'pending' LIMIT 1").bind(userId).first();
  if (pending) throw new Error("已有申请审核中，请等待结果或先撤回该申请。");
  const images = method === "student_card" ? [await encodeImage(form.get("identityPhoto"))] : [];
  const identityKey = method === "chsi_code" ? hash(`report:${code}`) : hash(`student-photo:${images[0]}`);
  const reportKey = method === "chsi_code" ? hash(`report:${code}`) : null;
  const duplicate = await db.prepare("SELECT id FROM verification_requests WHERE (identity_key = ? OR (? IS NOT NULL AND report_key = ?)) AND user_id != ? AND status IN ('pending', 'approved') LIMIT 1").bind(identityKey, reportKey, reportKey, userId).first();
  if (duplicate) throw new Error("该学生凭据已被其他账号提交，请联系管理员核实。");
  const evidence = encrypt({ name: "", studentNumber: "", code: method === "chsi_code" ? code : "", challenge: "", enrollmentUntil: "", images }, userId);
  const timestamp = new Date().toISOString(), expires = new Date(Date.now() + 14 * 86400_000).toISOString();
  try {
    const result = await db.batch([
      db.prepare(`INSERT INTO verification_requests (user_id, method, university, identifier, note, status, created_at, evidence_version, encrypted_evidence, evidence_expires_at, identity_key, report_key, enrollment_until)
        SELECT ?, ?, ?, ?, ?, 'pending', ?, 2, ?, ?, ?, ?, NULL
        WHERE NOT EXISTS (SELECT 1 FROM verification_requests WHERE user_id = ? AND status = 'pending')
          AND NOT EXISTS (SELECT 1 FROM verification_requests WHERE user_id != ? AND status IN ('pending','approved') AND (identity_key = ? OR (? IS NOT NULL AND report_key = ?)))`)
        .bind(userId, method, school, method === "chsi_code" ? "学籍报告验证码" : "学生证照片", String(form.get("note") || "").trim().slice(0, 300), timestamp, evidence, expires, identityKey, reportKey, userId, userId, identityKey, reportKey, reportKey),
      db.prepare("UPDATE users SET verification_status = 'pending', updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM verification_requests WHERE user_id = ? AND created_at = ? AND status = 'pending' AND identity_key = ?)").bind(timestamp, userId, userId, timestamp, identityKey),
    ]);
    if (!result[0].meta.changes) throw new Error("duplicate");
  } catch { throw new Error("申请未保存，可能已有重复凭据或正在审核的申请，请刷新确认。"); }
  return { status: "pending" };
}
export async function withdrawStudentVerification(userId: string) {
  const db = getD1();
  await db.batch([
    db.prepare("UPDATE verification_requests SET status = 'withdrawn', encrypted_evidence = NULL, review_note = '申请人已撤回' WHERE user_id = ? AND status = 'pending'").bind(userId),
    db.prepare("UPDATE users SET verification_status = CASE WHEN campus_verified = 1 AND (verified_until IS NULL OR verified_until > ?) THEN 'approved' ELSE 'unverified' END WHERE id = ?").bind(new Date().toISOString(), userId),
  ]);
  return { withdrawn: true };
}
export async function getVerificationEvidence(actorId: string, requestId: number) {
  await requireAdmin(actorId); await purgeVerificationEvidence();
  const row = await getD1().prepare("SELECT * FROM verification_requests WHERE id = ?").bind(requestId).first<Row>();
  if (!row || row.status !== "pending" || !row.encrypted_evidence || ![1, 2].includes(Number(row.evidence_version))) throw new Error("没有可查看的有效材料；旧版文字申请需退回补交。");
  await getD1().prepare("INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, detail, created_at) VALUES (?, 'view_verification_evidence', 'verification', ?, NULL, ?)").bind(actorId, String(requestId), new Date().toISOString()).run();
  return { ...decrypt(String(row.encrypted_evidence), String(row.user_id)), university: String(row.university), method: String(row.method), evidenceExpiresAt: String(row.evidence_expires_at) };
}
export async function reviewStudentVerification(actorId: string, requestId: number, status: string, input: Row) {
  await requireAdmin(actorId); await purgeVerificationEvidence();
  if (!["approved", "rejected"].includes(status)) throw new Error("审核结果无效。");
  const db = getD1(), row = await db.prepare("SELECT * FROM verification_requests WHERE id = ?").bind(requestId).first<Row>();
  if (!row || row.status !== "pending") throw new Error("申请已处理或不存在，请刷新列表。");
  const reviewNote = String(input.note || "").trim().slice(0, 300) || (status === "approved" ? "高校身份材料审核通过" : "");
  if (status === "rejected" && reviewNote.length < 2) throw new Error("请填写退回理由，方便申请人修改。");
  let verifiedUntil: string | null = null;
  if (status === "approved") {
    if (![1, 2].includes(Number(row.evidence_version)) || !row.encrypted_evidence) throw new Error("旧版文字申请没有有效材料，请退回后重新提交。");
    const viewed = await db.prepare("SELECT id FROM audit_logs WHERE actor_user_id = ? AND action = 'view_verification_evidence' AND target_id = ? AND created_at >= ? LIMIT 1").bind(actorId, String(requestId), row.created_at).first();
    if (!viewed) throw new Error("请先打开并查看该申请的原始材料。");
    const legacyUntil = row.enrollment_until ? new Date(`${row.enrollment_until}T23:59:59.999+08:00`).getTime() : Infinity;
    const until = Math.min(Date.now() + 180 * 86400_000, legacyUntil);
    if (!Number.isFinite(until) || until <= Date.now()) throw new Error("材料已过期，请退回后重新提交。");
    verifiedUntil = new Date(until).toISOString();
  }
  const timestamp = new Date().toISOString();
  const changed = await db.batch([
    db.prepare("UPDATE verification_requests SET status = ?, reviewed_at = ?, reviewer_id = ?, review_note = ?, reviewed_checks_json = ?, encrypted_evidence = NULL WHERE id = ? AND status = 'pending'")
      .bind(status, timestamp, actorId, reviewNote, "[]", requestId),
    db.prepare(`UPDATE users SET campus_verified = ?, verified_until = ?, university = ?, verification_method = ?, verification_status = ?, onboarding_step = CASE WHEN ? = 1 THEN MAX(onboarding_step, 1) ELSE onboarding_step END, updated_at = ?
      WHERE id = ? AND EXISTS (SELECT 1 FROM verification_requests WHERE id = ? AND reviewed_at = ? AND reviewer_id = ? AND status = ?)`)
      .bind(status === "approved" ? 1 : 0, verifiedUntil, row.university, row.method, status, status === "approved" ? 1 : 0, timestamp, row.user_id, requestId, timestamp, actorId, status),
    db.prepare("INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, detail, created_at) SELECT ?, 'review_verification', 'verification', ?, ?, ? WHERE EXISTS (SELECT 1 FROM verification_requests WHERE id = ? AND reviewed_at = ? AND reviewer_id = ? AND status = ?)")
      .bind(actorId, String(requestId), JSON.stringify({ status, verifiedUntil }), timestamp, requestId, timestamp, actorId, status),
  ]);
  if (!changed[0].meta.changes) throw new Error("申请已被处理，请刷新列表。");
  return { id: requestId, status, verifiedUntil };
}
