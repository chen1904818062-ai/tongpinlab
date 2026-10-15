import { redirect } from "next/navigation";
import { CampusLogin } from "@/components/campus-login";
import { getCurrentIdentity, safeReturnPath } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const target = safeReturnPath((await searchParams).return_to);
  if (await getCurrentIdentity()) redirect(target);
  return <CampusLogin returnTo={target} />;
}
