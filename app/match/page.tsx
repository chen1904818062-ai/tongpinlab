import { redirect } from "next/navigation";
import { authSignOutPath, getCurrentIdentity } from "@/lib/auth";
import { CampusLogin } from "@/components/campus-login";
import { ProductShell } from "@/components/product-shell";
import { ensureUser, getProductSnapshot } from "@/db/repository";

export const dynamic = "force-dynamic";

export default async function MatchPage() {
  const identity = await getCurrentIdentity();
  if (!identity) return <CampusLogin returnTo="/onboarding" />;
  const user = await ensureUser(identity);
  if (!user.campusVerified || !user.questionnaireCompleted) redirect("/onboarding");
  const snapshot = await getProductSnapshot(user.id);
  return <ProductShell initialData={snapshot} signOutPath={authSignOutPath("/")} />;
}
