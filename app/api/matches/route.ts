import { confirmMatchIntent, getProductSnapshot } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { matchId?: number; intent?: "interested" | "pass" };
    if (!body.matchId || !["interested", "pass"].includes(String(body.intent))) throw new Error("请选择有效的匹配操作。");
    return ok(await confirmMatchIntent(user.id, body.matchId, body.intent!));
  } catch (error) {
    return fail(error);
  }
}

export async function GET() {
  try {
    const user = await requireApiUser();
    return ok(await getProductSnapshot(user.id));
  } catch (error) {
    return fail(error);
  }
}
