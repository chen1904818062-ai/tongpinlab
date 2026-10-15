import { addPlazaComment, createPlazaPost, deletePlazaPost, getPlazaSnapshot, togglePlazaLike } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { requireAppUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireAppUser("/match");
    return ok(await getPlazaSnapshot(user.id));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser("/match");
    const body = await request.json() as Record<string, unknown>;
    switch (body.action) {
      case "create_post":
        return ok(await createPlazaPost(user.id, String(body.category ?? ""), String(body.audience ?? ""), String(body.content ?? "")));
      case "toggle_like":
        return ok(await togglePlazaLike(user.id, Number(body.postId)));
      case "add_comment":
        return ok(await addPlazaComment(user.id, Number(body.postId), String(body.body ?? "")));
      case "delete_post":
        return ok(await deletePlazaPost(user.id, Number(body.postId)));
      default:
        throw new Error("不支持的广场操作。");
    }
  } catch (error) {
    return fail(error);
  }
}
