import "server-only";

import { DatabaseSync, type StatementSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { openTurso } from "./turso";
import type { AppDatabase, DatabaseStatement } from "./types";

type Row = Record<string, unknown>;
type SqlValue = string | number | bigint | null | Uint8Array;

class BoundStatement implements DatabaseStatement {
  constructor(private readonly statement: StatementSync, private readonly values: SqlValue[] = []) {}

  bind(...values: unknown[]) {
    return new BoundStatement(this.statement, values.map(normalizeValue));
  }

  async first<T extends Row = Row>(): Promise<T | null> {
    return (this.statement.get(...this.values) as T | undefined) ?? null;
  }

  async all<T extends Row = Row>(): Promise<{ results: T[]; success: boolean }> {
    return { results: this.statement.all(...this.values) as T[], success: true };
  }

  async run() { return this.runSync(); }

  runSync() {
    const result = this.statement.run(...this.values);
    return {
      success: true,
      meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
    };
  }
}

class ServerSqliteDatabase implements AppDatabase {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string): DatabaseStatement {
    return new BoundStatement(this.database.prepare(sql));
  }

  batch(statements: DatabaseStatement[]) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => {
        if (!(statement instanceof BoundStatement)) throw new Error("Mixed database statements");
        return statement.runSync();
      });
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

declare global {
  var __tongpinDatabase: AppDatabase | undefined;
}

function normalizeValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || value instanceof Uint8Array) return value;
  return String(value);
}

function openDatabase() {
  const filename = path.resolve(process.env.SQLITE_PATH || path.join(process.cwd(), "data", "tongpin.sqlite"));
  mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  applyMigrations(database);
  return new ServerSqliteDatabase(database);
}

function applyMigrations(database: DatabaseSync) {
  database.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const directory = path.join(process.cwd(), "drizzle");
  if (!existsSync(directory)) throw new Error(`数据库迁移目录不存在：${directory}`);
  const files = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const sql = readFileSync(path.join(directory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = database.prepare("SELECT checksum FROM _migrations WHERE name = ?").get(name) as { checksum?: string } | undefined;
    if (applied) {
      if (applied.checksum !== checksum) throw new Error(`已执行的数据库迁移被修改：${name}`);
      continue;
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.exec(statement);
      database.prepare("INSERT INTO _migrations (name, checksum, applied_at) VALUES (?, ?, ?)").run(name, checksum, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getD1(): AppDatabase {
  if (process.env.RENDER && process.env.DATABASE_PROVIDER !== "turso") {
    throw new Error("Render 部署必须配置 DATABASE_PROVIDER=turso，避免数据写入临时磁盘。");
  }
  const provider = process.env.DATABASE_PROVIDER || "sqlite";
  if (provider !== "sqlite" && provider !== "turso") throw new Error("未知数据库类型。");
  globalThis.__tongpinDatabase ??= provider === "turso" ? openTurso() : openDatabase();
  return globalThis.__tongpinDatabase;
}
