import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client/web";

export async function migrateTurso(client, directory = path.join(process.cwd(), "drizzle")) {
  await client.execute("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
  for (const name of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(directory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const transaction = await client.transaction("write");
    try {
      const applied = await transaction.execute({ sql: "SELECT checksum FROM _migrations WHERE name = ?", args: [name] });
      if (applied.rows.length) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
      } else {
        const statements = sql.split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean);
        await transaction.batch([
          ...statements.map((sql) => ({ sql, args: [] })),
          { sql: "INSERT INTO _migrations (name, checksum, applied_at) VALUES (?, ?, ?)", args: [name, checksum, new Date().toISOString()] },
        ]);
        process.stdout.write(`Applied ${name}\n`);
      }
      await transaction.commit();
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    } finally { transaction.close(); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken || !/^(libsql|https):\/\//.test(url)) throw new Error("Configure an encrypted TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.");
  const client = createClient({ url, authToken });
  try { await migrateTurso(client); process.stdout.write("Turso database ready\n"); }
  finally { client.close(); }
}
