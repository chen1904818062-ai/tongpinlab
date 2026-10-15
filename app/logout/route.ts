import { NextResponse } from "next/server";
import { destroyCurrentSession, safeReturnPath, SESSION_COOKIE, shouldUseSecureCookie } from "@/lib/auth";

export async function GET(request: Request) {
  await destroyCurrentSession();
  const response = NextResponse.redirect(new URL(safeReturnPath(new URL(request.url).searchParams.get("return_to"), "/"), request.url));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: shouldUseSecureCookie(), path: "/", maxAge: 0 });
  return response;
}
