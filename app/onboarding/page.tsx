import { OnboardingWizard } from "@/components/onboarding-wizard";
import { authSignOutPath, safeReturnPath } from "@/lib/auth";
import { getOnboardingSnapshot } from "@/db/repository";
import { requireAppUser } from "@/lib/session";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to, "/community");
  const user = await requireAppUser(`/onboarding?return_to=${encodeURIComponent(returnTo)}`);
  const snapshot = await getOnboardingSnapshot(user.id);
  return <OnboardingWizard initialData={snapshot} signOutPath={authSignOutPath("/")} returnTo={returnTo} />;
}
