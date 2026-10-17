import { createVerificationCode, completeQuestionnaire, saveProfile, saveQuestionnaireSection, verifyCampusCode } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as Record<string, unknown>;
    switch (body.action) {
      case "send_code":
        return ok(await createVerificationCode(user.id, String(body.email ?? "")));
      case "verify_code":
        return ok(await verifyCampusCode(user.id, String(body.email ?? ""), String(body.code ?? ""), String(body.university ?? "")));
      case "submit_verification":
        return fail(new Error("文字认证入口已关闭，请刷新页面，使用新的高校认证材料表单。"));
      case "save_profile":
        return ok(await saveProfile(user.id, (body.profile ?? {}) as Record<string, unknown>));
      case "save_section":
        return ok(await saveQuestionnaireSection(user.id, (body.answers ?? {}) as Record<string, number>, String(body.dimension ?? "")));
      case "complete":
        return ok(await completeQuestionnaire(user.id));
      default:
        return fail(new Error("不支持的注册操作。"));
    }
  } catch (error) {
    return fail(error);
  }
}
