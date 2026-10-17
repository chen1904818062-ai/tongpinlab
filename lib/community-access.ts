import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { shouldUseSecureCookie } from "@/lib/auth";

export const COMMUNITY_COOKIE = "tongpin_community";
const maxAge = 30 * 86400;
const scoreKeys = ["energy", "information", "decision", "rhythm"];

function secret() {
  if (process.env.AUTH_CODE_SECRET) return process.env.AUTH_CODE_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("浏览凭证尚未配置。");
  return "tongpin-community-development-only";
}
function sign(value: string) { return createHmac("sha256", secret()).update(`community-v1:${value}`).digest("base64url"); }

export function completedPersonality(body: Record<string, unknown>) {
  let scores: number[];
  if (Array.isArray(body.answers) && body.answers.length === 32 && body.answers.every((answer) => typeof answer === "number" && Number.isInteger(answer) && answer >= -2 && answer <= 2)) {
    scores = [0, 0, 0, 0];
    body.answers.slice(0, 24).forEach((answer, i) => { scores[i % 4] += Number(answer); });
  } else {
    const result = body.result as { source?: string; type?: string; scores?: Record<string, unknown>; traits?: Record<string, unknown> } | undefined;
    if (result?.source !== "wx-mini" || !result.scores || !result.traits) throw new Error("请先完成 32 题性格探索，再进入社区浏览。");
    scores = scoreKeys.map((key) => Number(result.scores?.[key]));
    const traits = ["connection", "expression", "conflict", "exploration"].map((key) => Number(result.traits?.[key]));
    if (scores.some((score) => !Number.isInteger(score) || Math.abs(score) > 12) || traits.some((score) => !Number.isInteger(score) || Math.abs(score) > 4)) throw new Error("小程序测试结果不完整。");
    const code = scores.map((score, i) => score > 0 ? ["E", "N", "F", "P"][i] : ["I", "S", "T", "J"][i]).join("");
    if (result.type !== code) throw new Error("测试结果不一致，请重新获取小程序入口。");
  }
  return scores.map((score, i) => score > 0 ? ["E", "N", "F", "P"][i] : ["I", "S", "T", "J"][i]).join("");
}

export async function grantCommunityAccess(type: string) {
  const encoded = Buffer.from(JSON.stringify({ type, expires: Date.now() + maxAge * 1000 })).toString("base64url");
  (await cookies()).set(COMMUNITY_COOKIE, `${encoded}.${sign(encoded)}`, { httpOnly: true, secure: shouldUseSecureCookie(), sameSite: "lax", path: "/", maxAge });
}

export async function getCommunityAccess() {
  const raw = (await cookies()).get(COMMUNITY_COOKIE)?.value;
  if (!raw || raw.length > 1024) return null;
  try {
    const [encoded, signature, extra] = raw.split(".");
    if (!encoded || !signature || extra) return null;
    const expected = Buffer.from(sign(encoded));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { type: string; expires: number };
    return /^[EI][SN][TF][JP]$/.test(value.type) && Number.isFinite(value.expires) && value.expires > Date.now() ? value : null;
  } catch { return null; }
}
