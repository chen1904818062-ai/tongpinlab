import { randomUUID } from "node:crypto";
import { updateProfilePhoto } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { uploadImage } from "@/lib/cos";
import { requireAppUser } from "@/lib/session";
import { uploadDatabaseAvatar } from "@/lib/avatar-storage";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    const user = await requireAppUser("/onboarding");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("请选择图片文件。 ");
    const extension = allowedTypes.get(file.type);
    if (!extension) throw new Error("仅支持 JPG、PNG 或 WebP 图片。 ");
    if (file.size > 5 * 1024 * 1024) throw new Error("图片不能超过 5MB。 ");
    const key = `profiles/${user.id}/${randomUUID()}.${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (process.env.RENDER && process.env.IMAGE_STORAGE !== "database") throw new Error("Render 免费部署必须使用数据库头像存储。");
    const useDatabase = process.env.IMAGE_STORAGE === "database";
    const url = useDatabase ? await uploadDatabaseAvatar(user.id, bytes) : await uploadImage(bytes, key, file.type);
    if (!useDatabase) await updateProfilePhoto(user.id, url);
    return ok({ url });
  } catch (error) {
    return fail(error);
  }
}
