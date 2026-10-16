import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = process.cwd();
const temporaryDirectory = path.join(root, ".tmp", "social-flow-verification");
const databasePath = path.join(temporaryDirectory, "test.sqlite");
const port = 3917;
const baseUrl = `http://127.0.0.1:${port}`;
const tokens = { a: "social-flow-user-a", b: "social-flow-user-b" };
const useTurso = process.argv.includes("--turso");

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function resetDatabase() {
  if (!temporaryDirectory.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("测试目录超出项目范围");
  if (existsSync(temporaryDirectory)) rmSync(temporaryDirectory, { recursive: true, force: true });
  mkdirSync(temporaryDirectory, { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  db.exec("CREATE TABLE _migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
  for (const file of readdirSync(path.join(root, "drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(root, "drizzle", file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) db.exec(statement);
    db.prepare("INSERT INTO _migrations (name, checksum, applied_at) VALUES (?, ?, ?)")
      .run(file, createHash("sha256").update(sql).digest("hex"), new Date().toISOString());
  }
  const timestamp = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 86400_000).toISOString();
  const insertUser = db.prepare(`
    INSERT INTO users (id, platform_user_id, email, display_name, campus_email, campus_verified, university,
      verification_method, verification_status, role, onboarding_step, questionnaire_completed, matching_enabled,
      status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'campus_email', 'approved', 'student', 8, 1, 1, 'active', ?, ?)
  `);
  const insertProfile = db.prepare(`
    INSERT INTO profiles (user_id, gender, grade, major, campus, hometown, height, smoking, looking_for, bio,
      interests_json, photo_url, personality_type, personality_scores_json, review_status, updated_at)
    VALUES (?, ?, '大三', ?, '主校区', ?, 170, '不吸烟', 'relationship', ?, ?, NULL, ?, '{}', 'approved', ?)
  `);
  insertUser.run("user-a", "email:a@example.edu.cn", "a@example.edu.cn", "测试甲", "a@a.edu.cn", "北京测试大学", timestamp, timestamp);
  insertUser.run("user-b", "email:b@example.edu.cn", "b@example.edu.cn", "测试乙", "b@b.edu.cn", "上海测试大学", timestamp, timestamp);
  insertProfile.run("user-a", "女", "计算机", "北京", "喜欢摄影和校园散步。", JSON.stringify(["摄影", "散步"]), "ENFP", timestamp);
  insertProfile.run("user-b", "男", "新闻", "上海", "喜欢摄影和纪录片。", JSON.stringify(["摄影", "纪录片"]), "INFP", timestamp);
  const insertAnswer = db.prepare("INSERT INTO questionnaire_answers (user_id, question_id, dimension, answer, updated_at) VALUES (?, ?, ?, ?, ?)");
  for (const userId of ["user-a", "user-b"]) {
    for (const dimension of ["life", "communication", "relationship", "values", "personality", "boundaries"]) {
      for (let index = 1; index <= 10; index += 1) insertAnswer.run(userId, `${dimension}-${String(index).padStart(2, "0")}`, dimension, userId === "user-a" ? 4 : index % 3 === 0 ? 3 : 4, timestamp);
    }
  }
  const insertSession = db.prepare("INSERT INTO auth_sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)");
  insertSession.run(createHash("sha256").update(tokens.a).digest("hex"), "user-a", expiresAt, timestamp, timestamp);
  insertSession.run(createHash("sha256").update(tokens.b).digest("hex"), "user-b", expiresAt, timestamp, timestamp);
  db.close();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("测试服务器启动超时");
}

async function request(pathname, token, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { cookie: `tongpin_session=${token}`, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers ?? {}) },
  });
  const type = response.headers.get("content-type") ?? "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}

async function action(pathname, token, body) {
  return request(pathname, token, { method: "POST", body: JSON.stringify(body) });
}

resetDatabase();
const standalone = path.join(root, ".next", "standalone");
cpSync(path.join(root, "drizzle"), path.join(standalone, "drizzle"), { recursive: true });
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
const serverArgs = [...(useTurso ? ["--import", pathToFileURL(path.join(root, "scripts/test-support/turso-http-fixture.mjs")).href] : []), path.join(standalone, "server.js")];
const serverOptions = {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "production",
    SQLITE_PATH: databasePath,
    AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026",
    AUTH_COOKIE_SECURE: "false",
    DEMO_SEED_ENABLED: "false",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_PROVIDER: useTurso ? "turso" : "sqlite",
    TURSO_DATABASE_URL: useTurso ? "https://turso.test" : "",
    TURSO_AUTH_TOKEN: useTurso ? "fixture-token" : "",
    IMAGE_STORAGE: "database",
    AUTH_ALLOW_DEMO_CODES: "true",
    ADMIN_EMAIL: "a@example.edu.cn",
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
};
let serverLog = "";
function startServer() {
  const child = spawn(process.execPath, serverArgs, serverOptions);
  child.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });
  return child;
}
let server = startServer();

try {
  await waitForServer();
  const loginCode = await action("/api/auth/email/send", "", { email: "fresh@example.com" });
  assert(loginCode.response.ok && loginCode.payload.data.demoCode, "测试环境可生成邮箱验证码");
  const loggedIn = await action("/api/auth/email/verify", "", { email: "fresh@example.com", code: loginCode.payload.data.demoCode });
  assert(loggedIn.response.ok && loggedIn.response.headers.get("set-cookie")?.includes("tongpin_session="), "异步验证码验证创建了持久化登录会话");
  const replay = await action("/api/auth/email/verify", "", { email: "fresh@example.com", code: loginCode.payload.data.demoCode });
  assert(!replay.response.ok, "使用过的验证码不能重复创建会话");
  assert((await request("/match", tokens.a)).response.ok, "账号 A 可以进入匹配页");
  assert((await request("/match", tokens.b)).response.ok, "账号 B 可以进入匹配页");

  const db = new DatabaseSync(databasePath);
  const ownerPage = await request("/admin", tokens.a);
  assert(ownerPage.response.ok && ownerPage.payload.includes("平台运行情况"), "现有所有者账号可以访问管理后台");
  assert(db.prepare("SELECT role FROM users WHERE id = 'user-a'").get().role === "admin", "已有所有者账号会同步为管理员");
  db.prepare("UPDATE users SET role = 'admin' WHERE id = 'user-b'").run();
  const blockedAdminPage = await request("/admin", tokens.b);
  assert(!blockedAdminPage.payload.includes("平台运行情况"), "其他账号即使残留 admin 角色也无法读取后台");
  const blockedAdminAction = await action("/api/admin", tokens.b, { action: "review_profile", userId: "user-a", reviewStatus: "approved" });
  assert(blockedAdminAction.response.status === 403, "普通账号直接调用后台接口返回 403");
  assert(!(await request("/match", tokens.b)).payload.includes("管理后台"), "普通账号看不到管理后台入口");
  assert((await request("/onboarding", tokens.a)).payload.includes("管理后台"), "所有者在认证页面也能进入后台");
  const rejectedGender = await action("/api/onboarding", tokens.a, { action: "save_profile", profile: { nickname: "测试甲", gender: "其他" } });
  assert(!rejectedGender.response.ok && rejectedGender.payload.error.includes("男生或女生") && db.prepare("SELECT gender FROM profiles WHERE user_id = 'user-a'").get().gender === "女", "后端拒绝其他性别值且不会修改原资料");
  const image = new Uint8Array(await sharp({ create: { width: 32, height: 32, channels: 3, background: "#4b37e8" } }).png().toBuffer());
  async function uploadAvatar() {
    const form = new FormData();
    form.set("file", new Blob([image], { type: "image/png" }), "avatar.png");
    const response = await fetch(`${baseUrl}/api/uploads`, { method: "POST", headers: { cookie: `tongpin_session=${tokens.a}` }, body: form });
    return { response, payload: await response.json() };
  }
  const uploaded = await uploadAvatar();
  assert(uploaded.response.ok, `头像上传完成并压缩存入数据库${uploaded.response.ok ? "" : `: ${uploaded.payload.error}`}`);
  const avatar = await fetch(`${baseUrl}${uploaded.payload.data.url}`);
  assert(avatar.ok && avatar.headers.get("content-type") === "image/webp" && (await avatar.arrayBuffer()).byteLength > 0, "公开头像地址返回数据库内的 WebP 图片");
  const replaced = await uploadAvatar();
  assert(replaced.response.ok && replaced.payload.data.url !== uploaded.payload.data.url, "替换头像使用新的图片地址");
  assert(Number(db.prepare("SELECT COUNT(*) AS count FROM avatar_images WHERE user_id = 'user-a'").get().count) === 1, "每个账号只保留当前头像，避免旧图片占用免费额度");
  assert((await fetch(`${baseUrl}${uploaded.payload.data.url}`)).status === 404, "旧头像已从数据库删除");
  const match = db.prepare("SELECT * FROM matches WHERE user_a_id != 'demo-candidate' AND user_b_id != 'demo-candidate'").get();
  assert(Boolean(match), "系统创建的是真实账号 A 与 B 的匹配，不是演示对象");

  const blockedMessage = await action("/api/messages", tokens.a, { matchId: match.id, body: "不应提前发送" });
  assert(!blockedMessage.response.ok, "未双向选择前不能发送私信");
  const firstIntent = await action("/api/matches", tokens.a, { matchId: match.id, intent: "interested" });
  assert(firstIntent.response.ok && firstIntent.payload.data.mutual === false, "账号 A 的喜欢状态已持久化并等待对方");
  const secondIntent = await action("/api/matches", tokens.b, { matchId: match.id, intent: "interested" });
  assert(secondIntent.response.ok && secondIntent.payload.data.mutual === true, "账号 B 同意后完成真实双向匹配");

  const sentByA = await action("/api/messages", tokens.a, { matchId: match.id, body: "你好，这是一条真实测试消息" });
  assert(sentByA.response.ok, "账号 A 可以发送数据库消息");
  const receivedByB = await request(`/api/messages?matchId=${match.id}&afterId=0`, tokens.b);
  assert(receivedByB.response.ok && receivedByB.payload.data.messages.some((item) => item.body.includes("真实测试消息")), "账号 B 可以拉取账号 A 的新消息");
  const sentByB = await action("/api/messages", tokens.b, { matchId: match.id, body: "收到，这是一条真实回复" });
  assert(sentByB.response.ok, "账号 B 可以真实回复");
  assert(Number(db.prepare("SELECT COUNT(*) AS count FROM messages WHERE match_id = ?").get(match.id).count) === 2, "双方消息刷新后仍保存在 SQLite");

  const created = await action("/api/plaza", tokens.a, { action: "create_post", category: "校园瞬间", audience: "national", content: "这是一条端到端测试动态" });
  assert(created.response.ok, "账号 A 可以发布广场动态");
  const nationalPostId = created.payload.data.id;
  const plazaForB = await request("/api/plaza", tokens.b);
  assert(plazaForB.payload.data.posts.some((post) => post.id === nationalPostId), "账号 B 可以看到全国动态");
  assert((await action("/api/plaza", tokens.b, { action: "toggle_like", postId: nationalPostId })).response.ok, "账号 B 可以点赞动态");
  assert((await action("/api/plaza", tokens.b, { action: "add_comment", postId: nationalPostId, body: "真实评论已收到" })).response.ok, "账号 B 可以评论动态");
  const plazaForA = await request("/api/plaza", tokens.a);
  const interactedPost = plazaForA.payload.data.posts.find((post) => post.id === nationalPostId);
  assert(interactedPost.likeCount === 1 && interactedPost.commentCount === 1, "点赞和评论计数对发布者可见并已持久化");
  const reported = await action("/api/reports", tokens.b, { targetUserId: "user-a", category: "广场内容", detail: `动态 #${nationalPostId} 测试举报` });
  assert(reported.response.ok && Number(db.prepare("SELECT COUNT(*) AS count FROM reports WHERE reporter_id = 'user-b' AND target_user_id = 'user-a'").get().count) === 1, "举报会进入管理员待处理记录");
  assert(!(await action("/api/reports", tokens.b, { targetUserId: "user-b", category: "测试", detail: "自我举报" })).response.ok, "系统拒绝自我举报");

  const privatePost = await action("/api/plaza", tokens.a, { action: "create_post", category: "校园瞬间", audience: "same_university", content: "只允许同校同学看到的测试动态" });
  const privatePostId = privatePost.payload.data.id;
  const privateView = await request("/api/plaza", tokens.b);
  assert(!privateView.payload.data.posts.some((post) => post.id === privatePostId), "不同学校账号看不到仅同校动态");
  assert(!(await action("/api/plaza", tokens.b, { action: "toggle_like", postId: privatePostId })).response.ok, "猜测动态 ID 也无法越权点赞仅同校动态");
  assert(!(await action("/api/plaza", tokens.b, { action: "add_comment", postId: privatePostId, body: "越权评论" })).response.ok, "猜测动态 ID 也无法越权评论仅同校动态");

  const deleted = await action("/api/plaza", tokens.a, { action: "delete_post", postId: nationalPostId });
  assert(deleted.response.ok, "发布者可以删除自己的动态");
  const afterDelete = await request("/api/plaza", tokens.b);
  assert(!afterDelete.payload.data.posts.some((post) => post.id === nationalPostId), "删除后的动态不再对其他用户显示");

  db.prepare("DELETE FROM questionnaire_answers WHERE user_id = 'user-a'").run();
  db.prepare("UPDATE users SET questionnaire_completed = 0 WHERE id = 'user-a'").run();
  for (const dimension of ["life", "communication", "relationship", "values", "boundaries"]) {
    const answers = Object.fromEntries(Array.from({ length: 4 }, (_, index) => [`${dimension}-${String(index + 1).padStart(2, "0")}`, index % 2 === 0 ? 4 : 3]));
    const saved = await action("/api/onboarding", tokens.a, { action: "save_section", dimension, answers });
    assert(saved.response.ok && saved.payload.data.saved === 4, `${dimension} 分组的 4 道偏好题可以保存`);
  }
  const completed = await action("/api/onboarding", tokens.a, { action: "complete" });
  assert(completed.response.ok && completed.payload.data.count === 20, "新版 20 题匹配偏好可以正常完成并解锁产品");
  db.close();
  await new Promise((resolve) => { server.once("exit", resolve); server.kill("SIGTERM"); });
  server = startServer();
  await waitForServer();
  assert((await request("/match", tokens.a)).response.ok, "应用进程重启后原登录会话仍然有效");
  assert((await fetch(`${baseUrl}${replaced.payload.data.url}`)).ok, "应用进程重启后头像仍可访问");
  const restored = await request(`/api/messages?matchId=${match.id}&afterId=0`, tokens.b);
  assert(restored.response.ok && restored.payload.data.messages.length === 2, "应用进程重启后双方私信仍可读取");
  console.log("\n真实双账号匹配、私信与社交广场验收全部通过。");
} catch (error) {
  console.error(serverLog);
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
