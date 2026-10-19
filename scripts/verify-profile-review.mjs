// Run after next build and scripts/verify-social-flow.mjs. Uses only a local fixture.
import { spawn } from "node:child_process";
import { cpSync, writeFileSync, mkdirSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd(), base = "http://127.0.0.1:3922";
const qa = path.join(root, ".tmp", "profile-review-browser");
mkdirSync(qa, { recursive: true });
for (const [source, dest] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"], ["drizzle", ".next/standalone/drizzle"]]) cpSync(path.join(root, source), path.join(root, dest), { recursive: true });
const database = path.join(qa, "preview.sqlite");
const sourceDatabase = new DatabaseSync(path.join(root, ".tmp/social-flow-verification/test.sqlite"), { readOnly: true });
await backup(sourceDatabase, database);
sourceDatabase.close();
const db = new DatabaseSync(database);
const server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: database, DATABASE_PROVIDER: "sqlite", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026", IMAGE_STORAGE: "database", AUTH_COOKIE_SECURE: "false", ADMIN_EMAIL: "a@example.edu.cn", DEMO_SEED_ENABLED: "false", AUTH_ALLOW_DEMO_CODES: "true", RESEND_API_KEY: "", EMAIL_FROM: "", PORT: "3922", HOSTNAME: "127.0.0.1" }, stdio: "ignore" });
let browser, ws, capture;
const checks = [], errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, name) => { if (!condition) throw Error(name); checks.push(name); console.log("PASS " + name); };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await pause(500); }
  browser = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9230", "--user-data-dir=" + path.join(qa, "browser"), "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let i = 0; i < 60; i++) { try { target = (await (await fetch("http://127.0.0.1:9230/json/list")).json()).find(item => item.type === "page"); if (target) break; } catch {} await pause(300); }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails); if (pending.has(message.id)) { const promise = pending.get(message.id); pending.delete(message.id); if (message.error) promise.reject(Error(message.error.message)); else promise.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(120); } throw Error("Timeout: " + expression); };
  const nav = async url => { await send("Page.navigate", { url: base + url }); await pause(120); await until("document.readyState==='complete' && location.pathname===" + JSON.stringify(new URL(url, base).pathname)); await pause(450); };
  const click = async expression => { await evaluate(`(${expression}).scrollIntoView({block:'center',behavior:'instant'})`); await pause(100); const point = await evaluate(`(()=>{const rect=(${expression}).getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};})()`); await send("Input.dispatchMouseEvent", {type:"mousePressed",button:"left",clickCount:1,...point}); await send("Input.dispatchMouseEvent", {type:"mouseReleased",button:"left",clickCount:1,...point}); await pause(300); };
  const input = async (selector, value, kind = "HTMLInputElement") => { await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause(180); };
  capture = async name => { const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); writeFileSync(path.join(qa, name + ".png"), Buffer.from(image.data, "base64")); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.clearBrowserCookies");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });

  const a = 'tongpin_session=social-flow-user-a', b = 'tongpin_session=social-flow-user-b';
  async function request(url, cookie = '', options = {}) {
    const response = await fetch(base + url, { ...options, redirect: 'manual', headers: { cookie, ...options.headers } });
    const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
    return { response, payload };
  }
  async function upload(cookie, color) {
    const bytes = await sharp({ create: { width: 600, height: 600, channels: 3, background: color } }).png().toBuffer();
    const form = new FormData(); form.set('file', new File([bytes], 'synthetic-avatar.png', { type: 'image/png' }));
    const result = await request('/api/uploads', cookie, { method: 'POST', body: form });
    assert(result.response.ok, 'Synthetic avatar upload persists successfully');
    return result.payload.data.url;
  }
  assert((await request('/api/admin?userId=user-b')).response.status === 401, 'Anonymous visitors cannot view submitted user profiles');
  assert((await request('/api/admin?userId=user-a', b)).response.status === 403, 'Ordinary students cannot read admin profile details');
  assert((await request('/api/admin?userId=missing', a)).response.status === 404, 'Missing or deleted accounts return no profile');
  const detail = await request('/api/admin?userId=user-b', a);
  assert(detail.response.ok && detail.payload.data.profile.bio && detail.payload.data.user.email, 'Owner can read actual submitted biography and account information');
  assert(detail.response.headers.get('cache-control').includes('no-store') && !('answers' in detail.payload.data) && !JSON.stringify(detail.payload).includes('code_hash'), 'Admin detail excludes private answers and credentials and cannot be cached');
  assert(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='view_user_profile' AND target_id='user-b'").get().n > 0, 'Profile detail access is audited without duplicating submitted content');
  const oldUrl = await upload(a, '#cc9955'), newUrl = await upload(a, '#448877');
  assert(oldUrl !== newUrl && (await request(oldUrl)).response.status === 404 && (await request(newUrl)).response.ok, 'Replacement changes the avatar URL and removes the old blob');
  await send('Network.setCookie', { name: 'tongpin_session', value: 'social-flow-user-a', url: base });
  await nav('/'); await evaluate('localStorage.clear();sessionStorage.clear()');
  await evaluate(`localStorage.setItem('tongpin-onboarding-draft-v1:user-a',JSON.stringify({profile:{photoUrl:${JSON.stringify(oldUrl)},bio:'尚未保存的介绍草稿'},answers:{},savedAt:Date.now()}))`);
  await nav('/onboarding');
  await click("Array.from(document.querySelectorAll('aside nav button')).find(item=>item.innerText.includes('基本资料'))");
  await until("Boolean(document.querySelector('input[type=file]'))");
  assert(await evaluate(`decodeURIComponent(document.querySelector('img[alt="个人头像"]').getAttribute('src')).includes(${JSON.stringify(newUrl)})`), 'A stale avatar draft never replaces the current server avatar in the editor');
  assert(await evaluate("document.querySelector('textarea').value==='尚未保存的介绍草稿'"), 'Unsaved textual profile drafts still restore normally');
  await pause(500);
  assert(await evaluate("!('photoUrl' in JSON.parse(localStorage.getItem('tongpin-onboarding-draft-v1:user-a')).profile)"), 'Old avatar URLs are removed from persistent profile drafts');
  const uploadFile = path.join(qa, 'synthetic-new-avatar.png');
  await sharp({ create: { width: 640, height: 640, channels: 3, background: '#9b785e' } }).png().toFile(uploadFile);
  const dom = await send('DOM.getDocument');
  const fileInput = await send('DOM.querySelector', { nodeId: dom.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [uploadFile] });
  for (let i = 0; i < 80 && db.prepare("SELECT photo_url FROM profiles WHERE user_id='user-a'").get().photo_url === newUrl; i++) await pause(150);
  const latest = db.prepare("SELECT photo_url FROM profiles WHERE user_id='user-a'").get().photo_url;
  assert(latest !== newUrl, 'Choosing a replacement avatar in the browser saves it without requiring profile submission');
  await nav('/community?tab=profile');
  await until(`Array.from(document.querySelectorAll('img[alt$="的头像"]')).filter(image=>new URL(image.src).pathname===${JSON.stringify(latest)}&&image.complete&&image.naturalWidth>0).length===2`);
  assert(await evaluate(`Array.from(document.querySelectorAll('img[alt$="的头像"]')).filter(image=>new URL(image.src).pathname===${JSON.stringify(latest)}&&image.complete&&image.naturalWidth>0).length===2`), 'Profile and header display the same newly uploaded avatar');
  await capture('profile-avatar-desktop');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await pause(200);
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Mobile profile avatar layout fits the screen');
  await capture('profile-avatar-mobile');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await nav('/admin');
  await click("Array.from(document.querySelectorAll('tr')).find(row=>row.innerText.includes('测试乙')).querySelector('button')");
  await until("document.querySelector('[role=dialog]')?.innerText.includes('自我介绍')");
  assert(await evaluate("document.querySelector('[role=dialog]').innerText.includes('专业')&&document.querySelector('[role=dialog]').innerText.includes('兴趣爱好')&&Boolean(document.querySelector('[role=dialog] button'))"), 'Admin user action opens submitted profile details before review controls');
  await capture('admin-profile-details');
  await click("Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='通过资料审核')");
  await until("!document.querySelector('[role=dialog]')");
  assert(db.prepare("SELECT review_status FROM profiles WHERE user_id='user-b'").get().review_status === 'approved', 'Profile review succeeds from the submitted-details dialog');
  await request('/api/verification', b, { method: 'DELETE' });
  const form = new FormData();
  for (const [key, value] of Object.entries({ method: 'chsi_code', university: '本地测试大学', identifier: 'REVIEW20261019AB', note: '补充说明：这是本地合成的审核材料', consent: 'true' })) form.set(key, value);
  const submit = await request('/api/verification', b, { method: 'POST', body: form });
  assert(submit.response.ok, 'Synthetic report application is accepted with an optional applicant note');
  const reportId = db.prepare("SELECT id FROM verification_requests WHERE user_id='user-b' AND status='pending' ORDER BY id DESC LIMIT 1").get().id;
  assert((await request('/api/admin/verification?id=' + reportId, b)).response.status === 403, 'Applicants cannot read administrator-only decrypted materials');
  await nav('/admin'); await click("Array.from(document.querySelectorAll('[role=tab]')).find(tab=>tab.innerText.includes('高校认证'))");
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await click("Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='查看材料并审核')");
  await until("document.querySelector('[role=dialog]')?.innerText.includes('重新加载材料')");
  assert(await evaluate("document.querySelector('[role=dialog]').innerText.includes('补充说明：这是本地合成的审核材料')&&Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='确认通过').disabled"), 'Failed evidence fetch preserves application information and disables approval');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await click("Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='重新加载材料')");
  await until("document.querySelector('[role=dialog]')?.innerText.includes('REVIEW20261019AB')");
  assert(await evaluate("!Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='确认通过').disabled"), 'Retry loads the actual decrypted report code and enables deliberate approval');
  await capture('admin-report-material');
  await click("Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='确认通过')");
  await until("!document.querySelector('[role=dialog]')");
  assert(db.prepare('SELECT status,encrypted_evidence FROM verification_requests WHERE id=?').get(reportId).encrypted_evidence === null, 'Approved original evidence is still removed according to the existing retention policy');
  await click("Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='查看申请详情')");
  await until("document.querySelector('[role=dialog]')?.innerText.includes('已清理的照片和报告码无法再次查看')");
  assert(!(await evaluate("document.querySelector('[role=dialog]').innerText")).includes('REVIEW20261019AB'), 'Processed applications show saved summaries and explain why erased originals are unavailable');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }); await pause(150);
  const card = new FormData(); for (const [key, value] of Object.entries({ method: 'student_card', university: '本地学生证测试大学', consent: 'true', note: '本地学生证图片测试' })) card.set(key, value);
  const cardImage = await sharp({ create: { width: 900, height: 1400, channels: 3, background: '#c8d9ca' } }).jpeg().toBuffer();
  card.set('identityPhoto', new File([cardImage], 'synthetic-card.jpg', { type: 'image/jpeg' }));
  assert((await request('/api/verification', b, { method: 'POST', body: card })).response.ok, 'Synthetic student card image submission succeeds');
  await nav('/admin'); await click("Array.from(document.querySelectorAll('[role=tab]')).find(tab=>tab.innerText.includes('高校认证'))");
  await click("Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='查看材料并审核')");
  await until("document.querySelector('img[alt=\"学生证照片\"]')?.naturalWidth>0");
  assert(await evaluate("document.querySelector('img[alt=\"学生证照片\"]').getAttribute('src').startsWith('data:image/jpeg;base64,')"), 'Pending student card review displays the actual decrypted uploaded image');
  await click("Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='放大查看照片')");
  assert(await evaluate("!document.querySelector('img[alt=\"学生证照片\"]').className.includes('max-h-')"), 'Administrator can expand the student card image for closer inspection');
  await capture('admin-student-card-desktop');
  for (const width of [390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true }); await pause(200);
    assert(await evaluate("document.querySelector('[role=dialog]').getBoundingClientRect().width<=innerWidth&&document.querySelector('[role=dialog]').scrollWidth<=document.querySelector('[role=dialog]').clientWidth"), width + 'px evidence dialog fits without horizontal overflow');
    await capture('admin-student-card-' + width);
  }
  await input('[role=dialog] textarea', '图片测试：请补充清晰的有效学生信息', 'HTMLTextAreaElement');
  await click("Array.from(document.querySelectorAll('[role=dialog] button')).find(button=>button.innerText==='退回修改')");
  await until("!document.querySelector('[role=dialog]')");
  assert(db.prepare("SELECT status,review_note FROM verification_requests WHERE user_id='user-b' ORDER BY id DESC LIMIT 1").get().review_note === '图片测试：请补充清晰的有效学生信息', 'Student card can be returned with a clear reason after inspecting the image');
  assert(errors.length === 0, 'No uncaught browser exceptions during avatar update and administrator review');
  writeFileSync(path.join(qa, 'checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
  console.log('TOTAL ' + checks.length);

}catch(error){if(capture)await capture("failure");throw error;}
finally{if(ws)ws.close();if(browser)browser.kill();server.kill();db.close();}
