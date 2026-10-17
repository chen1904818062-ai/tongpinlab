import { CompanionConflictError, getCompanionExperience, updateCompanionExperience } from "@/db/companion-experiences";
import { requireApiUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await getCompanionExperience(user.id, new URL(request.url).searchParams.get("companion") || ""), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await updateCompanionExperience(user.id, await request.json() as Record<string, unknown>), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return fail(error, error instanceof CompanionConflictError ? 409 : undefined); }
}
