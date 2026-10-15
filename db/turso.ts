import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client/web";
import type { AppDatabase, DatabaseStatement, QueryResult, Row } from "./types";

function value(input: unknown): InValue {
  if (input === null || input === undefined) return null;
  if (typeof input === "boolean") return input ? 1 : 0;
  if (input instanceof Uint8Array) return input.slice().buffer;
  if (typeof input === "string" || typeof input === "number" || typeof input === "bigint") return input;
  return String(input);
}

function result(set: ResultSet): QueryResult {
  return { success: true, meta: { changes: set.rowsAffected, last_row_id: Number(set.lastInsertRowid ?? 0) } };
}

class TursoStatement implements DatabaseStatement {
  private client: Client;
  readonly sql: string;
  readonly args: InValue[];

  constructor(client: Client, sql: string, args: InValue[] = []) {
    this.client = client;
    this.sql = sql;
    this.args = args;
  }
  bind(...values: unknown[]) { return new TursoStatement(this.client, this.sql, values.map(value)); }
  async first<T extends Row = Row>(): Promise<T | null> {
    const set = await this.client.execute({ sql: this.sql, args: this.args });
    return set.rows.length ? Object.fromEntries(Object.entries(set.rows[0])) as T : null;
  }
  async all<T extends Row = Row>() {
    const set = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: set.rows.map((row) => Object.fromEntries(Object.entries(row)) as T), success: true };
  }
  async run() { return result(await this.client.execute({ sql: this.sql, args: this.args })); }
}

export class TursoDatabase implements AppDatabase {
  private client: Client;
  constructor(client: Client) { this.client = client; }
  prepare(sql: string) { return new TursoStatement(this.client, sql); }
  async batch(statements: DatabaseStatement[]) {
    const queries = statements.map((statement) => {
      if (!(statement instanceof TursoStatement)) throw new Error("Mixed database statements");
      return { sql: statement.sql, args: statement.args };
    });
    if (!queries.length) return [];
    return (await this.client.batch(queries, "write")).map(result);
  }
}

export function openTurso() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN 未配置。");
  if (!/^(libsql|https):\/\//.test(url)) throw new Error("Turso 必须使用加密云数据库地址。");
  return new TursoDatabase(createClient({ url, authToken }));
}
