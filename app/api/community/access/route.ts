import { completedPersonality, grantCommunityAccess } from "@/lib/community-access";
import { fail, ok } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const type = completedPersonality(body);
    await grantCommunityAccess(type);
    return ok({ personalityType: type });
  } catch (error) { return fail(error, 400); }
}
