import { getVerificationEvidence } from "@/db/student-verification";
import { requireApiUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await getVerificationEvidence(user.id, Number(new URL(request.url).searchParams.get("id"))), { headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return fail(error); }
}
