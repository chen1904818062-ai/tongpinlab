import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getD1 } from "@/db";

export async function uploadDatabaseAvatar(userId: string, input: Uint8Array) {
  const bytes = await sharp(input, { limitInputPixels: 36_000_000, animated: false })
    .rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 }).toBuffer();
  if (bytes.byteLength > 384 * 1024) throw new Error("图片内容过于复杂，请换一张较小的头像。");
  const id = randomUUID();
  const url = `/uploads/avatars/${id}`;
  const db = getD1();
  // Replacing an avatar deletes the previous blob, and the profile URL changes
  // in the same transaction. No file is written to Render's temporary disk.
  await db.batch([
    db.prepare(`INSERT INTO avatar_images (user_id, id, content_type, bytes, updated_at)
      VALUES (?, ?, 'image/webp', ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET id = excluded.id, bytes = excluded.bytes,
        content_type = excluded.content_type, updated_at = excluded.updated_at`)
      .bind(userId, id, bytes, new Date().toISOString()),
    db.prepare("UPDATE profiles SET photo_url = ?, review_status = 'pending', updated_at = ? WHERE user_id = ?")
      .bind(url, new Date().toISOString(), userId),
  ]);
  return url;
}
