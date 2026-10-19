// Run after next build and scripts/verify-social-flow.mjs. Uses only a local fixture.
import { spawn } from "node:child_process";
import { cpSync, writeFileSync, mkdirSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd(), base = "http://127.0.0.1:3923";
const qa = path.join(root, ".tmp", "plaza-avatar-browser");
mkdirSync(qa, { recursive: true });
for (const [source, dest] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"], ["drizzle", ".next/standalone/drizzle"]]) cpSync(path.join(root, source), path.join(root, dest), { recursive: true });
const database = path.join(qa, "preview.sqlite");
const sourceDatabase = new DatabaseSync(path.join(root, ".tmp/social-flow-verification/test.sqlite"), { readOnly: true });
await backup(sourceDatabase, database);
sourceDatabase.close();
const db = new DatabaseSync(database);
const server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: database, DATABASE_PROVIDER: "sqlite", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026", IMAGE_STORAGE: "database", AUTH_COOKIE_SECURE: "false", ADMIN_EMAIL: "a@example.edu.cn", DEMO_SEED_ENABLED: "false", AUTH_ALLOW_DEMO_CODES: "true", RESEND_API_KEY: "", EMAIL_FROM: "", PORT: "3923", HOSTNAME: "127.0.0.1" }, stdio: "ignore" });
let browser, ws, capture;
const checks = [], errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, name) => { if (!condition) throw Error(name); checks.push(name); console.log("PASS " + name); };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await pause(500); }
  browser = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9231", "--user-data-dir=" + path.join(qa, "browser"), "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let i = 0; i < 60; i++) { try { target = (await (await fetch("http://127.0.0.1:9231/json/list")).json()).find(item => item.type === "page"); if (target) break; } catch {} await pause(300); }
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
    return { response, payload: await response.json() };
  }
  const post = (url, cookie, body) => request(url, cookie, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  async function upload(color) {
    const bytes = await sharp({ create: { width: 600, height: 600, channels: 3, background: color } }).png().toBuffer();
    const form = new FormData(); form.set('file', new File([bytes], 'synthetic-avatar.png', { type: 'image/png' }));
    const result = await request('/api/uploads', a, { method: 'POST', body: form });
    if (!result.response.ok) throw Error(result.payload.error);
    return result.payload.data.url;
  }
  const oldUrl = await upload('#cc9955');
  const publication = await post('/api/plaza', a, { action: 'create_post', category: '校园瞬间', audience: 'public', content: '头像同步检查：这是本地公开动态。' });
  const postId = publication.payload.data.id;
  assert(publication.response.ok, 'Local synthetic author can publish a public plaza post');
  const snapshot = (await request('/api/plaza', a)).payload.data;
  const officialId = snapshot.posts.find(item => item.official).id;
  const ownReply = await post('/api/plaza', a, { action: 'add_comment', postId, body: '头像同步检查：普通动态下的留言' });
  assert(ownReply.payload.data.avatar === oldUrl, 'New comment response carries the current author avatar');
  await post('/api/plaza', a, { action: 'add_comment', postId: officialId, body: '头像同步检查：官方话题下的留言' });
  const privatePost = await post('/api/plaza', a, { action: 'create_post', category: '校园瞬间', audience: 'same_university', content: '头像同步检查：仅同校的内容。' });
  const grant = await post('/api/community/access', '', { answers: Array(32).fill(-2) });
  const guest = grant.response.headers.get('set-cookie').split(';')[0];
  for (const [label, cookie, endpoint] of [['Authenticated', b, '/api/plaza'], ['Guest', guest, '/api/community']]) {
    const current = (await request(endpoint, cookie)).payload.data;
    const item = current.posts.find(item => item.id === postId);
    assert(item.avatar === oldUrl && item.comments.find(comment => comment.authorId === 'user-a').avatar === oldUrl, label + ' feed displays author and ordinary-comment avatars');
    const official = current.posts.find(item => item.id === officialId);
    assert(official.comments.find(comment => comment.authorId === 'user-a').avatar === oldUrl, label + ' official-topic replies include the real student avatar');
    assert(official.avatar.includes('/personality/') && official.comments.find(comment => comment.official).avatar === official.avatar, label + ' official companion images remain distinct from student avatars');
    assert(!current.posts.some(item => item.id === privatePost.payload.data.id), label + ' feed still hides same-university posts from other audiences');
    assert(!JSON.stringify(current).includes('a@example.edu.cn') && !JSON.stringify(current).includes('encrypted_evidence'), label + ' avatar fields expose no email or identity evidence');
  }
  await send('Network.setCookie', { name: 'tongpin_session', value: 'social-flow-user-a', url: base });
  await nav('/community?tab=plaza');
  const imageCheck = (id, url) => `Array.from(document.querySelectorAll('#plaza-post-${id} img')).some(image=>new URL(image.src).pathname===${JSON.stringify(url)}&&image.complete&&image.naturalWidth>0)`;
  await until(imageCheck(postId, oldUrl));
  assert(await evaluate(imageCheck(postId, oldUrl)), 'Browser renders the uploaded photo beside the authored plaza post');
  const newest = await upload('#448877');
  await evaluate("window.dispatchEvent(new Event('focus'))");
  await until(imageCheck(postId, newest));
  assert(await evaluate(`document.querySelector('#plaza-post-${postId} > header img')&&Array.from(document.querySelectorAll('#plaza-post-${postId} .plaza-comment-avatar img')).some(image=>new URL(image.src).pathname===${JSON.stringify(newest)})`), 'Returning to the page refreshes both the existing post and comment avatar without reposting');
  assert(await evaluate(`Array.from(document.querySelectorAll('#plaza-post-${officialId} .plaza-comment-avatar img')).some(image=>new URL(image.src).pathname===${JSON.stringify(newest)})`), 'Existing official-topic student replies switch to the latest uploaded avatar');
  for (const [label, cookie, endpoint] of [['Authenticated', b, '/api/plaza'], ['Guest', guest, '/api/community']]) {
    const current = (await request(endpoint, cookie)).payload.data;
    const item = current.posts.find(item => item.id === postId);
    assert(item.avatar === newest && item.comments.find(comment => comment.authorId === 'user-a').avatar === newest, label + ' API resolves old content against the latest profile photo');
  }
  await click(`Array.from(document.querySelectorAll('#plaza-post-${postId} .plaza-post-actions button')).find(button=>button.innerText.includes('评论'))`);
  await input(`#plaza-post-${postId} input[aria-label="评论内容"]`, '换头像后的新留言');
  await click(`document.querySelector('#plaza-post-${postId} button[aria-label="发送评论"]')`);
  await until(`document.querySelector('#plaza-post-${postId} .plaza-comments').innerText.includes('换头像后的新留言')`);
  assert(await evaluate(`Array.from(document.querySelectorAll('#plaza-post-${postId} .plaza-comment-row')).find(row=>row.innerText.includes('换头像后的新留言')).querySelector('img')&&new URL(Array.from(document.querySelectorAll('#plaza-post-${postId} .plaza-comment-row')).find(row=>row.innerText.includes('换头像后的新留言')).querySelector('img').src).pathname===${JSON.stringify(newest)}`), 'A newly submitted browser comment immediately displays the latest avatar');
  await evaluate(`document.getElementById('plaza-post-${postId}').scrollIntoView({block:'start'})`); await capture('plaza-avatar-desktop');
  for (const width of [390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true }); await pause(200);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), width + 'px plaza comments and avatars fit the screen');
    await capture('plaza-avatar-' + width);
  }
  await send('Network.clearBrowserCookies');
  await send('Network.setCookie', { name: 'tongpin_community', value: guest.substring(guest.indexOf('=') + 1), url: base });
  await nav('/community?tab=plaza'); await until(imageCheck(postId, newest));
  assert(await evaluate(imageCheck(postId, newest)), 'Guest browser displays the same current photo on public posts');
  assert(!(await evaluate('document.body.innerText')).includes('头像同步检查：仅同校的内容。'), 'Guest browser still cannot see the private same-university post');
  db.prepare("UPDATE profiles SET photo_url=NULL WHERE user_id='user-a'").run();
  await evaluate("window.dispatchEvent(new Event('focus'))");
  await until(`Boolean(document.querySelector('#plaza-post-${postId} header [aria-label$="的默认头像"]'))`);
  assert(await evaluate(`!document.querySelector('#plaza-post-${postId} header img')`), 'Authors without a photo retain a readable initial fallback');
  db.prepare("UPDATE profiles SET photo_url='/uploads/avatars/00000000-0000-4000-8000-000000000000' WHERE user_id='user-a'").run();
  await evaluate(`document.querySelector('#plaza-post-${postId} header').scrollIntoView({block:'center'});window.dispatchEvent(new Event('focus'))`);
  await until(`Boolean(document.querySelector('#plaza-post-${postId} header [aria-label$="的默认头像"]'))`);
  assert(await evaluate(`Boolean(document.querySelector('#plaza-post-${postId} header [aria-label$="的默认头像"]'))`), 'Unavailable photos fall back to the author initial rather than a broken image');
  db.prepare("UPDATE profiles SET photo_url=? WHERE user_id='user-a'").run(newest);
  await evaluate("window.dispatchEvent(new Event('focus'))"); await until(imageCheck(postId, newest));
  assert(await evaluate(imageCheck(postId, newest)), 'A valid replacement photo recovers after an earlier image failure');
  assert(errors.length === 0, 'No uncaught browser errors during plaza avatar replacement');
  writeFileSync(path.join(qa, 'checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2)); console.log('TOTAL ' + checks.length);

}catch(error){if(capture)await capture("failure");throw error;}
finally{if(ws)ws.close();if(browser)browser.kill();server.kill();db.close();}
