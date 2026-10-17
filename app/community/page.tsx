import { getCommunityViewer } from "@/lib/community-viewer";
import { getPublicCommunitySnapshot } from "@/db/community";
import { getPlazaSnapshot, getProductSnapshot } from "@/db/repository";
import { CommunityGate } from "@/components/community-shell";
import { ProductShell } from "@/components/product-shell";
import { authSignOutPath } from "@/lib/auth";

export default async function CommunityPage() {
  const viewer = await getCommunityViewer();
  if (!viewer.canBrowse) return <CommunityGate />;
  const [plazaData, product] = await Promise.all([
    viewer.ready ? getPlazaSnapshot(viewer.userId) : getPublicCommunitySnapshot(viewer.personalityType, viewer.userId),
    viewer.ready ? getProductSnapshot(viewer.userId) : Promise.resolve(null),
  ]);
  return <ProductShell viewer={viewer} initialData={product} plazaData={plazaData} signOutPath={authSignOutPath("/")} />;
}
