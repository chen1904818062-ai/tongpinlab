import "server-only";

import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { deliverLoginCode } from "@/lib/campus-email";

export type AuthIdentity = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  accountId?: string;
};

export const SESSION_COOKIE = "tongpin_session";
const SESSION_DAYS = 30;

function codeSecret() {
  const secret = process.env.AUTH_CODE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_CODE_SECRET 未配置。 ");
  return "tongpin-development-only-secret";
}

function hashCode(destination: string, code: string) {
  return createHmac("sha256", codeSecret()).update(`${destination}:${code}`).digest("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeReturnPath(value: string | null | undefined, fallback = "/match") {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function authSignInPath(returnTo: string) {
  return `/login?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function authSignOutPath(returnTo = "/") {
  return `/logout?return_to=${encodeURIComponent(safeReturnPath(returnTo, "/"))}`;
}

export async function getCurrentIdentity(): Promise<AuthIdentity | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getD1().prepare(`
    SELECT s.id, s.user_id, s.expires_at, u.platform_user_id, u.email, u.display_name
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'
  `).bind(hashToken(token), new Date().toISOString()).first<Record<string, unknown>>();
  if (!session) return null;
  return {
    accountId: String(session.user_id),
    userId: String(session.platform_user_id),
    displayName: String(session.display_name || session.email || "同学"),
    email: String(session.email || ""),
    fullName: String(session.display_name || "") || null,
  };
}

export async function requireIdentity(returnTo: string) {
  const identity = await getCurrentIdentity();
  if (identity) return identity;
  redirect(authSignInPath(returnTo));
}

export async function sendEmailLoginCode(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) throw new Error("请输入有效邮箱地址。 ");
  const db = getD1();
  const latest = await db.prepare("SELECT created_at FROM login_codes WHERE destination = ? ORDER BY created_at DESC LIMIT 1").bind(email).first<{ created_at: string }>();
  if (latest && Date.now() - new Date(latest.created_at).getTime() < 60_000) throw new Error("验证码发送较频繁，请 60 秒后重试。 ");
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db.prepare("SELECT COUNT(*) AS count FROM login_codes WHERE destination = ? AND created_at > ?").bind(email, hourAgo).first<{ count: number }>();
  if (Number(recent?.count || 0) >= 5) throw new Error("验证码请求次数过多，请稍后再试。 ");
  const code = String(randomInt(100000, 1000000));
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  // Validate the server-side secret before sending. Otherwise a production
  // misconfiguration could email a code that can never be persisted or used.
  const codeHash = hashCode(email, code);
  const delivery = await deliverLoginCode(email, code);
  await db.prepare("INSERT INTO login_codes (destination, channel, code_hash, expires_at, created_at) VALUES (?, 'email', ?, ?, ?)")
    .bind(email, codeHash, expiresAt, createdAt).run();
  return { email, expiresAt, ...delivery };
}

export async function verifyEmailLoginCode(rawEmail: string, code: string) {
  const email = rawEmail.trim().toLowerCase();
  const db = getD1();
  const record = await db.prepare(`
    SELECT * FROM login_codes WHERE destination = ? AND channel = 'email' AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).bind(email).first<Record<string, unknown>>();
  if (!record || new Date(String(record.expires_at)).getTime() < Date.now()) throw new Error("验证码无效或已过期。 ");
  if (Number(record.attempts || 0) >= 5) throw new Error("验证失败次数过多，请重新获取验证码。 ");
  if (String(record.code_hash) !== hashCode(email, code.trim())) {
    await db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").bind(record.id).run();
    throw new Error("验证码错误。 ");
  }
  const consumed = await db.prepare("UPDATE login_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND attempts < 5 AND expires_at > ?")
    .bind(new Date().toISOString(), record.id, new Date().toISOString()).run();
  if (consumed.meta.changes !== 1) throw new Error("验证码已使用或已过期。");
  return { userId: `email:${email}`, displayName: email.split("@")[0], email, fullName: null } satisfies AuthIdentity;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  const db = getD1();
  await db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now.toISOString()).run();
  await db.prepare("INSERT INTO auth_sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .bind(hashToken(token), userId, expires.toISOString(), now.toISOString(), now.toISOString()).run();
  return { token, expires };
}

export async function destroyCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await getD1().prepare("DELETE FROM auth_sessions WHERE id = ?").bind(hashToken(token)).run();
}

export function sessionCookieOptions(expires: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: shouldUseSecureCookie(), path: "/", expires };
}

export function shouldUseSecureCookie() {
  return process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_SECURE !== "false";
}
