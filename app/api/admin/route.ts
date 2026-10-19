import { getAdminProfile, resolveReport, reviewProfile } from "@/db/repository";
import { reviewStudentVerification } from "@/db/student-verification";
import { fail, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await getAdminProfile(user.id, new URL(request.url).searchParams.get("userId") || ""), { headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail(new Error("仅管理员可以操作。"), 403);
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "resolve_report") {
      return ok(await resolveReport(user.id, Number(body.reportId), body.status === "dismissed" ? "dismissed" : "resolved", String(body.note ?? "")));
    }
    if (body.action === "review_profile") {
      return ok(await reviewProfile(user.id, String(body.userId), body.reviewStatus === "rejected" ? "rejected" : "approved"));
    }
    if (body.action === "review_verification") {
      return ok(await reviewStudentVerification(user.id, Number(body.requestId), String(body.status), body));
    }
    return fail(new Error("不支持的管理操作。"));
  } catch (error) {
    return fail(error);
  }
}
