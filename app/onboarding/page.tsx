import { OnboardingWizard } from "@/components/onboarding-wizard";
import { authSignOutPath } from "@/lib/auth";
import { getOnboardingSnapshot } from "@/db/repository";
import { requireAppUser } from "@/lib/session";

export default async function OnboardingPage() {
  const user = await requireAppUser("/onboarding");
  const snapshot = await getOnboardingSnapshot(user.id);
  return <OnboardingWizard initialData={snapshot} signOutPath={authSignOutPath("/")} />;
}
