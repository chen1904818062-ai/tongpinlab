import { cookies } from "next/headers";
import { ensureUser } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { createSession, safeReturnPath, sessionCookieOptions, SESSION_COOKIE, verifyEmailLoginCode } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; code?: string; returnTo?: string };
    const identity = await verifyEmailLoginCode(String(body.email || ""), String(body.code || ""));
    const user = await ensureUser(identity);
    const session = await createSession(user.id);
    (await cookies()).set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expires));
    return ok({ redirectTo: safeReturnPath(body.returnTo, user.campusVerified ? "/match" : "/onboarding") });
  } catch (error) {
    return fail(error);
  }
}
