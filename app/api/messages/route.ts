import { addMessage, getConversationUpdates } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { matchId?: number; body?: string };
    if (!body.matchId) throw new Error("缺少会话信息。");
    return ok(await addMessage(user.id, body.matchId, String(body.body ?? "")));
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const matchId = Number(url.searchParams.get("matchId"));
    const afterId = Number(url.searchParams.get("afterId") ?? 0);
    if (!Number.isInteger(matchId) || matchId <= 0) throw new Error("缺少会话信息。");
    return ok(await getConversationUpdates(user.id, matchId, afterId));
  } catch (error) {
    return fail(error);
  }
}
