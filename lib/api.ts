import { NextResponse } from "next/server";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "操作失败，请稍后再试。";
  return NextResponse.json({ ok: false, error: message }, { status });
}
