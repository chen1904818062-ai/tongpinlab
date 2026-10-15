import { setMatching } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireAppUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser("/");
    const body = await request.json() as { matchingEnabled?: boolean };
    return ok(await setMatching(user.id, Boolean(body.matchingEnabled)));
  } catch (error) {
    return fail(error);
  }
}
