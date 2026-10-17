import { createHash, createHmac } from "node:crypto";
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

  const userCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get().count);
  assert((await request("/api/community", "")).response.status === 403, "未完成测评不能直接读取社区接口");
  assert((await request("/community", "")).payload.includes("带着自己的频率"), "未测评的游客看到测评入口");
  for (const body of [{ answers: Array(31).fill(-2) }, { answers: [...Array(31).fill(-2), 0.5] }, { type: "INFP" }]) {
    assert((await action("/api/community/access", "", body)).response.status === 400, "不完整或无效测评不能领取浏览凭证");
  }
  const access = await action("/api/community/access", "", { answers: Array(32).fill(-2) });
  const guestCookie = access.response.headers.get("set-cookie")?.split(";")[0];
  assert(access.response.ok && access.payload.data.personalityType === "ISTJ" && Boolean(guestCookie), "完成 32 题可领取正确人格的游客浏览凭证");
  assert(/httponly/i.test(access.response.headers.get("set-cookie")) && /samesite=lax/i.test(access.response.headers.get("set-cookie")), "游客凭证使用 HttpOnly 与 SameSite Cookie");
  const guest = (pathname, options = {}) => request(pathname, "", { ...options, headers: { cookie: guestCookie, ...options.headers } });
  const guestPage = await guest("/community");
  assert(guestPage.response.ok && guestPage.payload.includes("小同") && guestPage.payload.includes("小频") && guestPage.payload.includes("官方虚拟伙伴"), "游客可免登录进入社区并看到明确标识的虚拟伙伴");
  assert(Number(db.prepare("SELECT COUNT(*) AS count FROM users").get().count) === userCount, "浏览和虚拟伙伴不会创建冒充真人的账号");
  assert((await request("/api/community", "", { headers: { cookie: `${guestCookie}tampered` } })).response.status === 403, "篡改浏览凭证会被拒绝");
  const expired = Buffer.from(JSON.stringify({ type: "ISTJ", expires: Date.now() - 1000 })).toString("base64url");
  const expiredSignature = createHmac("sha256", "test-only-secret-that-is-long-enough-2026").update(`community-v1:${expired}`).digest("base64url");
  assert((await request("/api/community", "", { headers: { cookie: `tongpin_community=${expired}.${expiredSignature}` } })).response.status === 403, "已过期的浏览凭证会被拒绝");
  const freshCookie = loggedIn.response.headers.get("set-cookie").split(";")[0];
  for (const pathname of ["/api/plaza", "/api/matches", "/api/messages", "/api/settings", "/api/reports"]) {
    const options = { method: "POST", body: JSON.stringify({ action: "create_post", content: "不能绕过准备流程", body: "不能绕过准备流程", postId: -1002, matchId: 1, intent: "interested", targetUserId: "user-a", category: "测试", detail: "不能绕过准备流程" }) };
    assert((await guest(pathname, options)).response.status === 401, `${pathname} 拒绝未登录游客直接互动`);
    assert((await request(pathname, "", { ...options, headers: { cookie: freshCookie } })).response.status === 403, `${pathname} 拒绝尚未完成准备的账号直接互动`);
  }
  assert((await request("/api/plaza", "", { headers: { cookie: freshCookie } })).response.status === 403, "不完整账号不能读取认证用户广场");
  assert((await request("/api/messages?matchId=1", "", { headers: { cookie: freshCookie } })).response.status === 403, "不完整账号不能读取私信");
  db.prepare("UPDATE profiles SET major = '  ' WHERE user_id = 'user-b'").run();
  assert((await action("/api/plaza", tokens.b, { action: "toggle_like", postId: -1002 })).response.status === 403, "仅有完成标记但资料缺失的账号也不能互动");
  db.prepare("UPDATE profiles SET major = '新闻' WHERE user_id = 'user-b'").run();
  db.prepare("DELETE FROM questionnaire_answers WHERE user_id = 'user-b' AND question_id = 'life-01'").run();
  assert((await action("/api/settings", tokens.b, { matchingEnabled: true })).response.status === 403, "缺少必答题时不能绕过问卷开启匹配");
  db.prepare("INSERT INTO questionnaire_answers (user_id, question_id, dimension, answer, updated_at) VALUES ('user-b', 'life-01', 'life', 4, ?)").run(new Date().toISOString());
  assert(!(await action("/api/onboarding", tokens.a, { action: "save_section", dimension: "life", answers: { "life-01": 2.5 } })).response.ok, "问卷拒绝非整数答案");
  const limitedNational = await action("/api/plaza", tokens.a, { action: "create_post", category: "校园瞬间", audience: "national", content: "游客不能看到的全国认证动态" });
  const limitedSchool = await action("/api/plaza", tokens.a, { action: "create_post", category: "校园瞬间", audience: "same_university", content: "游客不能看到的同校动态" });
  const explicitPublic = await action("/api/plaza", tokens.a, { action: "create_post", category: "校园瞬间", audience: "public", content: "主动公开给完成测评游客的动态" });
  assert(limitedNational.response.ok && limitedSchool.response.ok && explicitPublic.response.ok, "认证用户可以明确选择三种动态可见范围");
  await action("/api/plaza", tokens.a, { action: "add_comment", postId: limitedNational.payload.data.id, body: "私有动态下的评论不能泄露" });
  await action("/api/plaza", tokens.b, { action: "add_comment", postId: explicitPublic.payload.data.id, body: "主动公开的评论" });
  const publicSnapshot = await guest("/api/community");
  const publicText = JSON.stringify(publicSnapshot.payload);
  assert(publicSnapshot.payload.data.posts.some((post) => post.id === explicitPublic.payload.data.id) && publicText.includes("主动公开的评论"), "游客可看到主动公开的动态和评论");
  assert(!publicText.includes("游客不能看到") && !publicText.includes("私有动态下") && !publicText.includes("@example") && !publicText.includes("campus_email"), "游客响应不泄露全国、同校动态、私有评论或邮箱");
  db.prepare("UPDATE users SET status = 'suspended' WHERE id = 'user-a'").run();
  assert(!(await guest("/api/community")).payload.data.posts.some((post) => post.id === explicitPublic.payload.data.id), "被停用作者的公开动态不会继续展示");
  db.prepare("UPDATE users SET status = 'active' WHERE id = 'user-a'").run();
  assert((await action("/api/plaza", tokens.a, { action: "toggle_like", postId: -1002 })).response.ok, "认证用户可给官方话题点赞");
  assert((await action("/api/plaza", tokens.a, { action: "add_comment", postId: -1002, body: "真实同学参与官方话题" })).response.ok, "认证用户可参与官方话题");
  const officialPost = (await guest("/api/community")).payload.data.posts.find((post) => post.id === -1002);
  assert(officialPost.likeCount === 1 && officialPost.commentCount === 1 && officialPost.comments.some((item) => item.official) && officialPost.comments.some((item) => item.body === "真实同学参与官方话题"), "官方话题保存真实互动计数并明确标记预设引导");
  assert(!(await action("/api/plaza", tokens.a, { action: "add_comment", postId: -99999, body: "不存在的话题" })).response.ok, "未知官方话题 ID 无法写入评论");
  assert(Number(db.prepare("SELECT COUNT(*) AS count FROM users").get().count) === userCount, "虚拟伙伴始终不进入真人账号与匹配池");

  assert((await guest("/api/companions?companion=official-xiaotong")).response.status === 401, "游客不能直接读取虚拟体验对话");
  assert((await request("/api/companions?companion=official-xiaotong", "", { headers: { cookie: freshCookie } })).response.status === 403, "准备不完整的账号不能读取虚拟体验对话");
  assert((await request("/api/companions", "", { method: "POST", body: JSON.stringify({ companionId: "official-xiaotong", action: "start", sceneId: "class-break", revision: 0 }), headers: { cookie: freshCookie } })).response.status === 403, "虚拟体验同样要求全部四项参与准备");
  const safePreview = await guest("/community?tab=match");
  assert(safePreview.response.ok && safePreview.payload.includes("体验匹配") && !safePreview.payload.includes('"email":"a@example.edu.cn"') && !safePreview.payload.includes('"candidate":{"id":"user-'), "游客可以看体验介绍，但页面不包含真人候选资料");
  const beforeExperience = { users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count, matches: db.prepare("SELECT COUNT(*) AS count FROM matches").get().count, messages: db.prepare("SELECT COUNT(*) AS count FROM messages").get().count };
  const emptyExperience = await request("/api/companions?companion=official-xiaotong", tokens.a);
  assert(emptyExperience.response.ok && emptyExperience.payload.data.started === false && db.prepare("SELECT COUNT(*) AS count FROM companion_experiences").get().count === 0, "查看体验不自动创建会话或伪造双向选择");
  const startedExperience = await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "start", sceneId: "class-break", revision: 0 });
  assert(startedExperience.response.ok && startedExperience.payload.data.revision === 1 && startedExperience.payload.data.options.length === 2, "认证用户主动开始校园破冰情境");
  const firstChoice = await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "choose", choiceId: "a", revision: 1 });
  assert(firstChoice.response.ok && firstChoice.payload.data.revision === 2 && firstChoice.payload.data.messages.some((item) => item.role === "user") && firstChoice.payload.data.messages.some((item) => item.text.includes("共同经历")), "情境选择保存真实进度并返回对应预设回应");
  assert((await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "choose", choiceId: "b", revision: 1 })).response.status === 409, "旧版本或重复点击不能重复追加对话");
  assert((await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "choose", choiceId: "任意自由输入", revision: 2 })).response.status === 400, "虚拟体验只接受当前预设选项");
  assert((await action("/api/companions", tokens.a, { companionId: "fake-student", action: "start", sceneId: "class-break", revision: 0 })).response.status === 400, "不能伪造第三个虚拟角色");
  assert((await action("/api/companions", tokens.a, { companionId: "official-xiaopin", action: "start", sceneId: "class-break", revision: 0 })).response.status === 400, "不能跨角色指定不属于该伙伴的情境");
  const otherExperience = await request("/api/companions?companion=official-xiaotong&userId=user-a", tokens.b);
  assert(otherExperience.payload.data.started === false, "指定他人 userId 也无法读取别人的体验记录");
  let experienceRevision = 2;
  for (let i = 0; i < 2; i++) {
    const nextChoice = await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "choose", choiceId: "b", revision: experienceRevision });
    assert(nextChoice.response.ok, "校园情境可以逐步完成");
    experienceRevision = nextChoice.payload.data.revision;
  }
  const completedExperience = await request("/api/companions?companion=official-xiaotong", tokens.a);
  assert(completedExperience.payload.data.complete && completedExperience.payload.data.options.length === 0, "情境结束后明确完成，不制造无限自动聊天");
  assert((await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "choose", choiceId: "a", revision: experienceRevision })).response.status === 400, "已完成的情境不会继续接受伪造回复");
  const restartedExperience = await action("/api/companions", tokens.a, { companionId: "official-xiaotong", action: "start", sceneId: "shared-interest", revision: experienceRevision });
  assert(restartedExperience.response.ok && restartedExperience.payload.data.sceneId === "shared-interest" && restartedExperience.payload.data.messages.length === 1, "用户可以主动换到另一段校园情境");
  const capybaraExperience = await action("/api/companions", tokens.a, { companionId: "official-xiaopin", action: "start", sceneId: "campus-walk", revision: 0 });
  assert(capybaraExperience.response.ok && capybaraExperience.payload.data.sceneId === "campus-walk" && db.prepare("SELECT COUNT(*) AS count FROM companion_experiences WHERE user_id='user-a'").get().count === 2, "两位伙伴分别保存对话且每人每角色只有一份当前记录");
  assert(db.prepare("SELECT COUNT(*) AS count FROM users").get().count === beforeExperience.users && db.prepare("SELECT COUNT(*) AS count FROM matches").get().count === beforeExperience.matches && db.prepare("SELECT COUNT(*) AS count FROM messages").get().count === beforeExperience.messages, "体验不会创建虚假学生、占用真人推荐或混入真人私信");

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
  const restoredExperience = await request("/api/companions?companion=official-xiaotong", tokens.a);
  assert(restoredExperience.response.ok && restoredExperience.payload.data.sceneId === "shared-interest" && restoredExperience.payload.data.revision === restartedExperience.payload.data.revision, "应用重启后虚拟体验进度仍属于原账号并可继续");
  console.log("\n真实双账号匹配、私信与社交广场验收全部通过。");
} catch (error) {
  console.error(serverLog);
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
