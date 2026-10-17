import { getStudentVerificationState, submitStudentVerification, withdrawStudentVerification } from "@/db/student-verification";
import { fail, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

const headers = { "cache-control": "private, no-store" };
export async function GET() {
  try { const user = await requireApiUser(); return ok(await getStudentVerificationState(user.id), { headers }); }
  catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new Error("请使用认证材料表单提交。");
    if (Number(request.headers.get("content-length") || 0) > 7 * 1024 * 1024) throw new Error("认证材料总大小不能超过 7MB。");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("认证材料为空。");
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > 7 * 1024 * 1024) { await reader.cancel(); throw new Error("认证材料总大小不能超过 7MB。"); } chunks.push(value); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData();
    return ok(await submitStudentVerification(user.id, form), { headers });
  } catch (error) { return fail(error); }
}
export async function DELETE() {
  try { const user = await requireApiUser(); return ok(await withdrawStudentVerification(user.id), { headers }); }
  catch (error) { return fail(error); }
}
