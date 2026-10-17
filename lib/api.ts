import { NextResponse } from "next/server";
import { AccessError } from "@/lib/access-error";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown, status?: number) {
  const message = error instanceof Error ? error.message : "操作失败，请稍后再试。";
  return NextResponse.json({ ok: false, error: message }, { status: status ?? (error instanceof AccessError ? error.status : 400) });
}
