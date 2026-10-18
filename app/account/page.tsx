import { AccountSettings } from "@/components/account-settings";
import { requireAppUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await requireAppUser("/account");
  return <AccountSettings userId={user.id} email={user.email} displayName={user.displayName} />;
}
