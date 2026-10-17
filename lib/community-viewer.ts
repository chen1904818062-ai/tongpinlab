import "server-only";
import { getCurrentIdentity } from "@/lib/auth";
import { ensureUser } from "@/db/repository";
import { getParticipationStatus } from "@/lib/participation";
import { getCommunityAccess } from "@/lib/community-access";

export async function getCommunityViewer() {
  const [identity, access] = await Promise.all([getCurrentIdentity(), getCommunityAccess()]);
  const user = identity ? await ensureUser(identity) : null;
  const status = user ? await getParticipationStatus(user.id) : null;
  const storedType = status?.personalityType || "";
  return {
    canBrowse: Boolean(access || /^[EI][SN][TF][JP]$/.test(storedType)),
    authenticated: Boolean(user), userId: user?.id || "", displayName: user?.displayName || "", role: user?.role || "", verificationMethod: user?.verificationMethod || "",
    ready: Boolean(status?.ready), campusVerified: Boolean(status?.campusVerified), profileReady: Boolean(status?.profileReady), questionnaireCompleted: Boolean(status?.questionnaireCompleted),
    answeredCount: status?.answeredCount || 0, total: status?.total || 20, personalityType: access?.type || storedType,
  };
}
export type CommunityViewer = Awaited<ReturnType<typeof getCommunityViewer>>;
