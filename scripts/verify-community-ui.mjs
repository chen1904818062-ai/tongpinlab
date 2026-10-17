// Run after next build and scripts/verify-social-flow.mjs. Uses only a local fixture.
import { spawn } from "node:child_process";
import { cpSync, writeFileSync, mkdirSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";

const root = process.cwd(), base = "http://127.0.0.1:3918";
const qa = path.join(root, ".tmp", "community-onboarding-qa");
mkdirSync(qa, { recursive: true });
for (const [source, dest] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"], ["drizzle", ".next/standalone/drizzle"]]) cpSync(path.join(root, source), path.join(root, dest), { recursive: true });
const database = path.join(qa, "preview.sqlite");
const sourceDatabase = new DatabaseSync(path.join(root, ".tmp/social-flow-verification/test.sqlite"), { readOnly: true });
await backup(sourceDatabase, database);
sourceDatabase.close();
const db = new DatabaseSync(database);
const server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: database, DATABASE_PROVIDER: "sqlite", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026", AUTH_COOKIE_SECURE: "false", ADMIN_EMAIL: "a@example.edu.cn", DEMO_SEED_ENABLED: "false", AUTH_ALLOW_DEMO_CODES: "true", RESEND_API_KEY: "", EMAIL_FROM: "", PORT: "3918", HOSTNAME: "127.0.0.1" }, stdio: "ignore" });
let browser, ws, capture;
const checks = [], errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, name) => { if (!condition) throw Error(name); checks.push(name); console.log("PASS " + name); };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await pause(500); }
  browser = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9228", "--user-data-dir=" + path.join(qa, "browser"), "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let i = 0; i < 60; i++) { try { target = (await (await fetch("http://127.0.0.1:9228/json/list")).json()).find(item => item.type === "page"); if (target) break; } catch {} await pause(300); }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails); if (pending.has(message.id)) { const promise = pending.get(message.id); pending.delete(message.id); if (message.error) promise.reject(Error(message.error.message)); else promise.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(120); } throw Error("Timeout: " + expression); };
  const nav = async url => { await send("Page.navigate", { url: base + url }); await pause(120); await until("document.readyState==='complete' && location.pathname===" + JSON.stringify(new URL(url, base).pathname)); await pause(450); };
  const click = async expression => { await evaluate(expression + ".click()"); await pause(300); };
  const input = async (selector, value, kind = "HTMLInputElement") => { await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause(180); };
  capture = async name => { const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); writeFileSync(path.join(qa, name + ".png"), Buffer.from(image.data, "base64")); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.clearBrowserCookies");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await nav("/"); await evaluate("localStorage.clear()");
  await nav("/community"); await until("document.body.innerText.includes('开始 / 继续性格测试')");
  assert(await evaluate("!document.querySelector('.plaza-post')"), "New visitor sees test entrance and no community feed"); await capture("community-gate-desktop");
  await nav("/test?type=infp&r=1,2,3,4"); await until("Boolean(document.querySelector('.premium-result'))");
  await nav("/community"); await until("document.body.innerText.includes('开始 / 继续性格测试')");
  assert(await evaluate("!document.querySelector('.plaza-post')"), "Shared result alone cannot unlock own community browsing");
  await nav("/test"); await until("Boolean(document.querySelector('.premium-quiz'))");
  for (let index = 0; index < 32; index++) {
    await until(`document.querySelector('.premium-quiz-panel')?.innerText.includes('第 ${index + 1} 题')`);
    await click("document.querySelector('[aria-label=\"很像左边\"]')");
  }
  await until("Boolean(document.querySelector('.premium-result'))");
  assert(await evaluate("JSON.parse(localStorage.getItem('campus-personality-v2')).answers.every(value=>value===-2)"), "Actual 32-question flow completes and saves answers");
  await click("Array.from(document.querySelectorAll('a')).find(item=>item.innerText.includes('先去社区逛逛'))");
  await until("location.pathname==='/community' && document.querySelectorAll('.companion-card').length===2");
  assert(await evaluate("!document.cookie.includes('tongpin_session') && document.querySelectorAll('.plaza-post.is-official').length===6"), "Completed visitor enters community without login and sees six official topics");
  assert(await evaluate("!document.body.innerText.includes('游客不能看到的') && document.body.innerText.includes('主动公开给完成测评游客的动态')"), "Browser feed exposes explicitly public content only");
  await capture("community-desktop");
  await click("document.querySelector('.companion-card button')"); await until("Boolean(document.querySelector('.companion-dialog'))");
  assert(await evaluate("document.querySelector('.companion-dialog').innerText.includes('预设产品说明')"), "Companion product guide identifies preset answers");
  await click("Array.from(document.querySelectorAll('.companion-question-list button')).find(item=>item.innerText.includes('没有高校邮箱'))");
  assert(await evaluate("document.querySelector('.companion-answer').innerText.includes('学信网')"), "Companion FAQ changes the answer on selection"); await capture("companion-faq-desktop");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" }); await pause(200);
  const countsBefore = db.prepare("SELECT COUNT(*) AS count FROM plaza_comments").get().count;
  await click("document.querySelector('#plaza-post--1002 .plaza-post-actions button:last-child')");
  await input("#plaza-post--1002 input", "想和同学聊聊校园里的晚霞");
  await click("document.querySelector('#plaza-post--1002 [aria-label=\"发送评论\"]')"); await until("Boolean(document.querySelector('.community-join-dialog'))");
  const joinUrl = await evaluate("document.querySelector('.community-join-dialog a').getAttribute('href')");
  const onboarding = new URL(joinUrl, base).searchParams.get("return_to");
  assert(new URL(onboarding, base).searchParams.get("return_to") === "/community?post=-1002", "Participation prompt retains nested login/onboarding return topic");
  assert(db.prepare("SELECT COUNT(*) AS count FROM plaza_comments").get().count === countsBefore, "Guest submit opens preparation prompt without writing a comment");
  assert(await evaluate("JSON.parse(localStorage.getItem('tongpin-plaza-draft-v2')).comments['-1002']==='想和同学聊聊校园里的晚霞'"), "Comment draft persists locally before login"); await capture("join-desktop");
  await nav(joinUrl); await until("Boolean(document.querySelector('#login-email'))");
  assert(await evaluate("location.search.includes('return_to')"), "Login page preserves preparation destination");
  // Use the existing isolated fixture session instead of sending a real email.
  await send("Network.setCookie", { name: "tongpin_session", value: "social-flow-user-a", url: base });
  await nav(onboarding); await until("document.body.innerText.includes('可以加入对话与匹配了')");
  await click("Array.from(document.querySelectorAll('a')).find(item=>item.innerText.includes('回到刚才的页面'))");
  await until("location.pathname==='/community' && Boolean(document.querySelector('#plaza-post--1002 input'))");
  assert(await evaluate("document.querySelector('#plaza-post--1002 input').value==='想和同学聊聊校园里的晚霞'"), "Returning prepared user finds original topic with restored draft");
  assert(db.prepare("SELECT COUNT(*) AS count FROM plaza_comments").get().count === countsBefore, "Return from preparation does not automatically publish draft");
  await click("document.querySelector('#plaza-post--1002 [aria-label=\"发送评论\"]')");
  await until("document.querySelector('#plaza-post--1002 .plaza-comments').innerText.includes('想和同学聊聊校园里的晚霞')");
  assert(db.prepare("SELECT COUNT(*) AS count FROM plaza_comments").get().count === countsBefore + 1, "Prepared user confirms and sends exactly one real comment");
  await capture("official-topic-comment");
  await nav(onboarding); await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('修改匹配偏好'))");
  await until("Boolean(document.querySelector('#life-01'))"); await click("document.querySelectorAll('#life-01 button')[4]");
  await until("document.querySelector('.onboarding-save-note').innerText.includes('已同步到账号')");
  assert(db.prepare("SELECT answer FROM questionnaire_answers WHERE user_id='user-a' AND question_id='life-01'").get().answer === 5, "One preference answer automatically syncs without submitting whole section");
  await nav(onboarding); await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('修改匹配偏好'))");
  assert(await evaluate("document.querySelectorAll('#life-01 button')[4].querySelector('svg')!==null"), "Auto-saved preference survives reload");
  await nav(onboarding); await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('修改个人资料'))");
  const originalBio = db.prepare("SELECT bio FROM profiles WHERE user_id='user-a'").get().bio;
  await input("textarea", "这是尚未提交的个人资料草稿", "HTMLTextAreaElement"); await nav("/community"); await nav(onboarding);
  await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('修改个人资料'))");
  assert(await evaluate("document.querySelector('textarea').value==='这是尚未提交的个人资料草稿'"), "Unsaved personal profile draft restores after leaving page");
  assert(db.prepare("SELECT bio FROM profiles WHERE user_id='user-a'").get().bio === originalBio, "Local profile draft never silently overwrites confirmed server profile");
  await send("Network.deleteCookies", { name: "tongpin_session", url: base }); await nav("/community");
  for (const [width, height] of [[390,844],[320,740]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true }); await nav("/community");
    assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `${width}px community has no horizontal overflow`); await capture(`community-mobile-${width}`);
    await click("document.querySelector('.community-actions button')"); await until("Boolean(document.querySelector('.community-join-dialog'))");
    assert(await evaluate("document.querySelector('.community-join-dialog').getBoundingClientRect().width<=innerWidth"), `${width}px preparation modal fits screen`); await capture(`join-mobile-${width}`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" }); await pause(200);
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await nav("/community?post=-1003"); await until("Boolean(document.querySelector('#plaza-post--1003 input'))");
  await input("#plaza-post--1003 input", "新同学的第一条校园分享");
  await click("document.querySelector('#plaza-post--1003 [aria-label=\"发送评论\"]')");
  await click("document.querySelector('.community-join-dialog a')"); await until("Boolean(document.querySelector('#login-email'))");
  await input("#login-email", "browser-flow@example.com");
  await click("document.querySelector('.premium-login-card button[type=submit]')");
  await until("document.querySelector('.premium-login-card').innerText.includes('本地演示验证码：')");
  const loginCode = await evaluate("document.querySelector('.premium-login-card').innerText.match(/本地演示验证码：(\\d{6})/)[1]");
  await input("#login-code", loginCode); await click("document.querySelector('.premium-login-card button[type=submit]')");
  await until("location.pathname==='/onboarding' && document.body.innerText.includes('选择最方便的学生认证方式')");
  assert(await evaluate("new URLSearchParams(location.search).get('return_to')==='/community?post=-1003'"), "New account email login preserves original topic through actual redirect");
  await input(".premium-onboarding section input", "浏览器测试大学");
  await input("input[placeholder='name@university.edu.cn']", "browser-flow@local.edu.cn");
  await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText==='获取验证码')");
  await until("document.body.innerText.includes('演示验证码：')");
  const campusCode = await evaluate("document.body.innerText.match(/演示验证码：(\\d{6})/)[1]");
  await input("input[placeholder='请输入验证码']", campusCode);
  await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('验证并继续'))");
  await until("Boolean(document.querySelector('input[placeholder=\"例如：电气工程\"]'))");
  await input("input[placeholder='匹配对象将看到这个名字']", "浏览器新同学");
  await input("input[placeholder='例如：电气工程']", "计算机");
  await evaluate("(()=>{const selects=document.querySelectorAll('section select'); for(const [index,value] of [[0,'女生'],[1,'大二']]){selects[index].value=value;selects[index].dispatchEvent(new Event('change',{bubbles:true}));}})()");
  await input("section textarea", "喜欢校园散步和认识新朋友", "HTMLTextAreaElement");
  await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('保存并填写 20 题'))");
  await until("Boolean(document.querySelector('#life-01'))");
  for (const dimension of ["life", "communication", "relationship", "values", "boundaries"]) {
    await until(`Boolean(document.querySelector('#${dimension}-01'))`);
    for (let index = 1; index <= 4; index++) await click(`document.querySelectorAll('#${dimension}-0${index} button')[3]`);
    await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText==='保存并继续' || item.innerText==='完成并进入社区')");
  }
  await until("location.pathname==='/community' && location.search==='?post=-1003' && Boolean(document.querySelector('#plaza-post--1003 input'))");
  assert(await evaluate("document.querySelector('#plaza-post--1003 input').value==='新同学的第一条校园分享' && !document.querySelector('.community-browse-note')"), "All four preparation steps return new student to original draft and unlock participation");
  const newUser = db.prepare("SELECT id,campus_verified,questionnaire_completed FROM users WHERE email='browser-flow@example.com'").get();
  assert(newUser.campus_verified === 1 && newUser.questionnaire_completed === 1 && db.prepare("SELECT COUNT(*) AS count FROM questionnaire_answers WHERE user_id=?").get(newUser.id).count === 20, "New account's campus verification, profile and all 20 answers persist in local database");
  assert(!db.prepare("SELECT id FROM plaza_comments WHERE author_id=?").get(newUser.id), "Completing preparation requires student confirmation before posting");
  await pause(1000);
  assert(await evaluate("document.querySelector('#plaza-post--1003').getBoundingClientRect().top>=0 && document.querySelector('#plaza-post--1003').getBoundingClientRect().top<innerHeight"), "Restored topic scrolls into the visible viewport");
  await capture("new-account-preparation-complete");
  assert(errors.length === 0, "No uncaught browser exceptions during community and preparation flow");
  writeFileSync(path.join(qa,"checks.json"),JSON.stringify({ checks, errors },null,2));
  console.log("Screenshots: " + qa);
} catch (error) { if (capture) await capture("failure"); throw error; }
finally { if (ws) ws.close(); if (browser) browser.kill(); server.kill(); db.close(); }
