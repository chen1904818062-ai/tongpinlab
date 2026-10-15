import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminSnapshot } from "@/db/repository";
import { requireAppUser } from "@/lib/session";

export default async function AdminPage() {
  const user = await requireAppUser("/admin");
  const snapshot = await getAdminSnapshot(user.id);
  return <AdminDashboard initialData={snapshot} />;
}
