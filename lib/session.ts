import { getCurrentIdentity, requireIdentity } from "@/lib/auth";
import { ensureUser } from "@/db/repository";
import { AccessError } from "@/lib/access-error";

export async function requireAppUser(returnTo = "/") {
  const identity = await requireIdentity(returnTo);
  return ensureUser(identity);
}

export async function requireApiUser() {
  const identity = await getCurrentIdentity();
  if (!identity) throw new AccessError("请先登录，再完成参与准备。", 401);
  return ensureUser(identity);
}
