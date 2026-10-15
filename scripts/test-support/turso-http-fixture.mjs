// Test-only Hrana v2 endpoint. The real libSQL HTTP client sends its protocol
// requests here; SQLite supplies durable state while responses arrive async.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const originalFetch = globalThis.fetch;
const streams = new Map();
function decode(value) {
  if (value.type === "null") return null;
  if (value.type === "integer") return BigInt(value.value);
  if (value.type === "blob") return Buffer.from(value.base64, "base64");
  return value.value;
}
function encode(value) {
  if (value === null) return { type: "null" };
  if (value instanceof Uint8Array) return { type: "blob", base64: Buffer.from(value).toString("base64") };
  if (typeof value === "bigint" || (typeof value === "number" && Number.isInteger(value))) return { type: "integer", value: String(value) };
  return { type: typeof value === "number" ? "float" : "text", value };
}
function execute(stream, query) {
  const sql = query.sql ?? stream.sql.get(query.sql_id);
  const statement = stream.db.prepare(sql);
  const args = (query.args ?? []).map(decode);
  const columns = statement.columns();
  let rows = [];
  let changes = 0;
  let last = null;
  if (columns.length && query.want_rows) {
    statement.setReadBigInts(true);
    statement.setReturnArrays(true);
    rows = statement.all(...args).map((row) => row.map(encode));
  } else {
    const result = statement.run(...args);
    changes = Number(result.changes);
    last = String(result.lastInsertRowid);
  }
  return { cols: columns.map((column) => ({ name: column.name, decltype: column.type })), rows,
    affected_row_count: changes, last_insert_rowid: last };
}
function condition(stream, test, results, errors) {
  if (!test) return true;
  if (test.type === "ok") return Boolean(results[test.step]);
  if (test.type === "error") return Boolean(errors[test.step]);
  if (test.type === "not") return !condition(stream, test.cond, results, errors);
  if (test.type === "and") return test.conds.every((item) => condition(stream, item, results, errors));
  if (test.type === "or") return test.conds.some((item) => condition(stream, item, results, errors));
  if (test.type === "is_autocommit") return !stream.db.isTransaction;
  throw new Error(`Unknown condition: ${test.type}`);
}
function errorPayload(error) { return { message: error.message, code: "SQLITE_ERROR" }; }
function handle(stream, request) {
  switch (request.type) {
    case "execute": return { type: "execute", result: execute(stream, request.stmt) };
    case "batch": {
      const results = [], errors = [];
      for (const step of request.batch.steps) {
        const index = results.length;
        results.push(null); errors.push(null);
        if (!condition(stream, step.condition, results, errors)) continue;
        try { results[index] = execute(stream, step.stmt); }
        catch (error) { errors[index] = errorPayload(error); }
      }
      return { type: "batch", result: { step_results: results, step_errors: errors } };
    }
    case "store_sql": stream.sql.set(request.sql_id, request.sql); return { type: "store_sql" };
    case "close_sql": stream.sql.delete(request.sql_id); return { type: "close_sql" };
    case "get_autocommit": return { type: "get_autocommit", is_autocommit: !stream.db.isTransaction };
    case "close":
      stream.db.close(); streams.delete(stream.id); return { type: "close" };
    default: throw new Error(`Unsupported fixture request: ${request.type}`);
  }
}
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (new URL(request.url).hostname !== "turso.test") return originalFetch(input, init);
  if (request.headers.get("authorization") !== "Bearer fixture-token") return new Response(null, { status: 401 });
  const body = await request.json();
  let stream = streams.get(body.baton);
  if (!stream) {
    const db = new DatabaseSync(process.env.SQLITE_PATH);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    stream = { db, sql: new Map(), id: randomUUID() };
    streams.set(stream.id, stream);
  }
  const results = body.requests.map((operation) => {
    try { return { type: "ok", response: handle(stream, operation) }; }
    catch (error) { return { type: "error", error: errorPayload(error) }; }
  });
  await new Promise((resolve) => setTimeout(resolve, 8));
  return Response.json({ baton: streams.has(stream.id) ? stream.id : null, base_url: null, results });
};
