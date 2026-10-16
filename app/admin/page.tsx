import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminSnapshot } from "@/db/repository";
import { requireAppUser } from "@/lib/session";
import { notFound } from "next/navigation";

export default async function AdminPage() {
  const user = await requireAppUser("/admin");
  if (user.role !== "admin") notFound();
  const snapshot = await getAdminSnapshot(user.id);
  return <AdminDashboard initialData={snapshot} />;
}
