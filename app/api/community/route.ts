import { getCommunityViewer } from "@/lib/community-viewer";
import { getPublicCommunitySnapshot } from "@/db/community";
import { fail, ok } from "@/lib/api";

export async function GET() {
  const viewer = await getCommunityViewer();
  if (!viewer.canBrowse) return fail(new Error("请先完成性格测试，再进入社区浏览。"), 403);
  return ok(await getPublicCommunitySnapshot(viewer.personalityType, viewer.userId), { headers: { "Cache-Control": "private, no-store" } });
}
