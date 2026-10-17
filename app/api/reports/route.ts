import { createReport } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { targetUserId?: string; category?: string; detail?: string };
    if (!body.targetUserId || !body.category) throw new Error("请选择举报原因。");
    return ok(await createReport(user.id, body.targetUserId, body.category, String(body.detail ?? "")));
  } catch (error) {
    return fail(error);
  }
}
