import { getCommunityViewer } from "@/lib/community-viewer";
import { getPublicCommunitySnapshot } from "@/db/community";
import { getPlazaSnapshot } from "@/db/repository";
import { CommunityGate, CommunityShell } from "@/components/community-shell";

export default async function CommunityPage() {
  const viewer = await getCommunityViewer();
  if (!viewer.canBrowse) return <CommunityGate />;
  const snapshot = viewer.ready ? await getPlazaSnapshot(viewer.userId) : await getPublicCommunitySnapshot(viewer.personalityType, viewer.userId);
  return <CommunityShell viewer={viewer} initialData={snapshot} />;
}
