import { resolveReport, reviewProfile, reviewVerification } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireAppUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser("/admin");
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "resolve_report") {
      return ok(await resolveReport(user.id, Number(body.reportId), body.status === "dismissed" ? "dismissed" : "resolved", String(body.note ?? "")));
    }
    if (body.action === "review_profile") {
      return ok(await reviewProfile(user.id, String(body.userId), body.reviewStatus === "rejected" ? "rejected" : "approved"));
    }
    if (body.action === "review_verification") {
      return ok(await reviewVerification(user.id, Number(body.requestId), body.status === "rejected" ? "rejected" : "approved"));
    }
    return fail(new Error("不支持的管理操作。"));
  } catch (error) {
    return fail(error, 403);
  }
}
