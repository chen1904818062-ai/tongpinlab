import { redirect } from "next/navigation";
import { authSignOutPath, getCurrentIdentity } from "@/lib/auth";
import { getParticipationStatus } from "@/lib/participation";
import { ProductShell } from "@/components/product-shell";
import { ensureUser, getProductSnapshot } from "@/db/repository";

export const dynamic = "force-dynamic";

export default async function MatchPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/community?join=matching");
  const user = await ensureUser(identity);
  if (!(await getParticipationStatus(user.id)).ready) redirect("/community?join=matching");
  const snapshot = await getProductSnapshot(user.id);
  return <ProductShell initialData={snapshot} signOutPath={authSignOutPath("/")} />;
}
