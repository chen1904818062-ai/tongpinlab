import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const filename = path.resolve(process.env.SQLITE_PATH || path.join(process.cwd(), "data", "tongpin.sqlite"));
const migrations = path.join(process.cwd(), "drizzle");
if (!existsSync(migrations)) throw new Error(`Missing migrations directory: ${migrations}`);
mkdirSync(path.dirname(filename), { recursive: true });
const database = new DatabaseSync(filename);
database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
database.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");

for (const name of readdirSync(migrations).filter((item) => item.endsWith(".sql")).sort()) {
  const sql = readFileSync(path.join(migrations, name), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const applied = database.prepare("SELECT checksum FROM _migrations WHERE name = ?").get(name);
  if (applied) {
    if (applied.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
    continue;
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.exec(statement);
    database.prepare("INSERT INTO _migrations (name, checksum, applied_at) VALUES (?, ?, ?)").run(name, checksum, new Date().toISOString());
    database.exec("COMMIT");
    process.stdout.write(`Applied ${name}\n`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
database.close();
process.stdout.write(`Database ready: ${filename}\n`);
