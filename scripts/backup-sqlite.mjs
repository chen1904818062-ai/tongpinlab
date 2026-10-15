import { createHash, createHmac } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const sourcePath = path.resolve(process.env.SQLITE_PATH || "/app/data/tongpin.sqlite");
const backupDir = path.resolve(process.env.BACKUP_DIR || "/app/backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const rawPath = path.join(backupDir, `tongpin-${stamp}.sqlite`);
const gzipPath = `${rawPath}.gz`;
await mkdir(backupDir, { recursive: true });
const source = new DatabaseSync(sourcePath, { readOnly: true });
await backup(source, rawPath);
source.close();
await writeFile(gzipPath, await gzipAsync(await readFile(rawPath), { level: 9 }));
await rm(rawPath, { force: true });

if (process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY && process.env.COS_BUCKET && process.env.COS_REGION) {
  const key = `${(process.env.COS_BACKUP_PREFIX || "backups").replace(/^\/+|\/+$/g, "")}/${path.basename(gzipPath)}`;
  await uploadToCos(await readFile(gzipPath), key);
  process.stdout.write(`Uploaded COS backup: ${key}\n`);
}

const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const cutoff = Date.now() - retentionDays * 86400_000;
for (const name of await readdir(backupDir)) {
  if (!name.startsWith("tongpin-") || !name.endsWith(".sqlite.gz")) continue;
  const filename = path.join(backupDir, name);
  if ((await stat(filename)).mtimeMs < cutoff) await rm(filename, { force: true });
}
process.stdout.write(`Backup ready: ${gzipPath}\n`);

async function uploadToCos(bytes, key) {
  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  const host = `${bucket}.cos.${region}.myqcloud.com`;
  const pathname = `/${key.split("/").map(encodeURIComponent).join("/")}`;
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 600}`;
  const sha1 = (value) => createHash("sha1").update(value).digest("hex");
  const hmac = (secret, value) => createHmac("sha1", secret).update(value).digest("hex");
  const httpString = `put\n${pathname}\n\nhost=${encodeURIComponent(host)}\n`;
  const signKey = hmac(secretKey, keyTime);
  const signature = hmac(signKey, `sha1\n${keyTime}\n${sha1(httpString)}\n`);
  const authorization = `q-sign-algorithm=sha1&q-ak=${encodeURIComponent(secretId)}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
  const response = await fetch(`https://${host}${pathname}`, { method: "PUT", headers: { authorization, "content-type": "application/gzip" }, body: bytes });
  if (!response.ok) throw new Error(`COS backup upload failed: ${response.status}`);
}
