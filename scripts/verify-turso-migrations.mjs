import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client/web";
import { migrateTurso } from "./migrate-turso.mjs";
import { TursoDatabase } from "../db/turso.ts";

mkdirSync(".tmp", { recursive: true });
const directory = mkdtempSync(path.resolve(".tmp", "turso-migrations-"));
process.env.SQLITE_PATH = path.join(directory, "database.sqlite");
await import("./test-support/turso-http-fixture.mjs");
const client = createClient({ url: "https://turso.test", authToken: "fixture-token" });
try {
  await migrateTurso(client);
  const count = (await client.execute("SELECT COUNT(*) AS count FROM _migrations")).rows[0].count;
  await migrateTurso(client);
  assert.equal((await client.execute("SELECT COUNT(*) AS count FROM _migrations")).rows[0].count, count);
  console.log("✓ HTTP 云数据库迁移可重复执行且不重复建表");

  await client.execute("UPDATE _migrations SET checksum = 'invalid' WHERE name = (SELECT name FROM _migrations ORDER BY name LIMIT 1)");
  await assert.rejects(() => migrateTurso(client), /Applied migration changed/);
  console.log("✓ 已执行迁移的内容变更会阻止启动");

  const broken = path.join(directory, "broken"); mkdirSync(broken);
  writeFileSync(path.join(broken, "9000_broken.sql"), "CREATE TABLE must_rollback (id INTEGER);\n--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);");
  await assert.rejects(() => migrateTurso(client, broken));
  assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE name = 'must_rollback'")).rows.length, 0);
  assert.equal((await client.execute("SELECT name FROM _migrations WHERE name = '9000_broken.sql'")).rows.length, 0);
  console.log("✓ 失败的远程迁移会回滚表结构和迁移记录");

  const db = new TursoDatabase(client);
  await client.execute("CREATE TABLE adapter_check (id INTEGER PRIMARY KEY, content TEXT, enabled INTEGER, bytes BLOB)");
  await db.prepare("INSERT INTO adapter_check VALUES (?, ?, ?, ?)").bind(1, "保存中文内容", true, new Uint8Array([2, 4, 6])).run();
  const row = await db.prepare("SELECT * FROM adapter_check WHERE id = ?").bind(1).first();
  assert.equal(row.content, "保存中文内容"); assert.equal(row.enabled, 1);
  assert.deepEqual([...new Uint8Array(row.bytes)], [2, 4, 6]);
  await assert.rejects(() => db.batch([
    db.prepare("INSERT INTO adapter_check (id) VALUES (?)").bind(2),
    db.prepare("INSERT INTO adapter_check (id) VALUES (?)").bind(1),
  ]));
  assert.equal(await db.prepare("SELECT id FROM adapter_check WHERE id = ?").bind(2).first(), null);
  console.log("✓ HTTP 驱动支持中文、二进制头像及批量写入回滚");

  const newClient = createClient({ url: "https://turso.test", authToken: "fixture-token" });
  try { assert.equal((await new TursoDatabase(newClient).prepare("SELECT content FROM adapter_check WHERE id = 1").first()).content, "保存中文内容"); }
  finally { newClient.close(); }
  console.log("✓ 重建数据库客户端后仍可读取已保存内容");
} finally { client.close(); }
