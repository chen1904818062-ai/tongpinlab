import { requireIdentity } from "@/lib/auth";
import { ensureUser } from "@/db/repository";

export async function requireAppUser(returnTo = "/") {
  const identity = await requireIdentity(returnTo);
  return ensureUser(identity);
}
