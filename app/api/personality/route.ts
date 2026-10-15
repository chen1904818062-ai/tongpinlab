import { savePersonalityResult } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireAppUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser("/match");
    const body = await request.json() as { type?: string; scores?: Record<string, number>; traits?: Record<string, number> };
    return ok(await savePersonalityResult(user.id, String(body.type ?? ""), body.scores ?? {}, body.traits ?? {}));
  } catch (error) {
    return fail(error);
  }
}
