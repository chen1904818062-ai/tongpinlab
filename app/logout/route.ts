import { NextResponse } from "next/server";
import { destroyCurrentSession, safeReturnPath, SESSION_COOKIE, shouldUseSecureCookie } from "@/lib/auth";

export async function GET(request: Request) {
  await destroyCurrentSession();
  // A relative Location keeps the public origin even behind Render's proxy.
  const response = new NextResponse(null, { status: 303, headers: { location: safeReturnPath(new URL(request.url).searchParams.get("return_to"), "/"), "cache-control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: shouldUseSecureCookie(), path: "/", maxAge: 0 });
  return response;
}
