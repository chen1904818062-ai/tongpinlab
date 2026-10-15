import "server-only";

import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function hmacSha1(key: string | Buffer, value: string) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export async function uploadImage(bytes: Uint8Array, key: string, contentType: string) {
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  if (!secretId || !secretKey || !bucket || !region) {
    if (process.env.NODE_ENV === "production" && process.env.COS_ALLOW_LOCAL_STORAGE !== "true") throw new Error("腾讯云 COS 尚未配置。 ");
    const localPath = path.join(process.cwd(), "public", "uploads", key);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, bytes);
    return `/uploads/${encodeObjectKey(key)}`;
  }

  const host = `${bucket}.cos.${region}.myqcloud.com`;
  const encodedKey = encodeObjectKey(key);
  const pathname = `/${encodedKey}`;
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 600}`;
  const headerList = "host";
  const httpString = `put\n${pathname}\n\nhost=${encodeURIComponent(host)}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signKey = hmacSha1(secretKey, keyTime);
  const signature = hmacSha1(signKey, stringToSign);
  const authorization = `q-sign-algorithm=sha1&q-ak=${encodeURIComponent(secretId)}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList}&q-url-param-list=&q-signature=${signature}`;
  const response = await fetch(`https://${host}${pathname}`, {
    method: "PUT",
    headers: { authorization, "content-type": contentType },
    body: Buffer.from(bytes) as unknown as BodyInit,
  });
  if (!response.ok) throw new Error(`图片上传失败（COS ${response.status}）。`);
  const publicBase = (process.env.COS_PUBLIC_BASE_URL || `https://${host}`).replace(/\/$/, "");
  return `${publicBase}${pathname}`;
}
