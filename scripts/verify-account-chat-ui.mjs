// Run after next build and scripts/verify-social-flow.mjs. Uses only a local fixture.
import { spawn } from "node:child_process";
import { cpSync, writeFileSync, mkdirSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";

const root = process.cwd(), base = "http://127.0.0.1:3921";
const qa = path.join(root, ".tmp", "account-chat-browser");
mkdirSync(qa, { recursive: true });
for (const [source, dest] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"], ["drizzle", ".next/standalone/drizzle"]]) cpSync(path.join(root, source), path.join(root, dest), { recursive: true });
const database = path.join(qa, "preview.sqlite");
const sourceDatabase = new DatabaseSync(path.join(root, ".tmp/social-flow-verification/test.sqlite"), { readOnly: true });
await backup(sourceDatabase, database);
sourceDatabase.close();
const db = new DatabaseSync(database);
const server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: database, DATABASE_PROVIDER: "sqlite", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026", AUTH_COOKIE_SECURE: "false", ADMIN_EMAIL: "a@example.edu.cn", DEMO_SEED_ENABLED: "false", AUTH_ALLOW_DEMO_CODES: "true", RESEND_API_KEY: "", EMAIL_FROM: "", PORT: "3921", HOSTNAME: "127.0.0.1" }, stdio: "ignore" });
let browser, ws, capture;
const checks = [], errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, name) => { if (!condition) throw Error(name); checks.push(name); console.log("PASS " + name); };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await pause(500); }
  browser = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9229", "--user-data-dir=" + path.join(qa, "browser"), "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let i = 0; i < 60; i++) { try { target = (await (await fetch("http://127.0.0.1:9229/json/list")).json()).find(item => item.type === "page"); if (target) break; } catch {} await pause(300); }
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

  await nav("/");await evaluate("localStorage.clear();sessionStorage.clear()");
  await send("Network.setCookie",{name:"tongpin_session",value:"social-flow-user-a",url:base});
  await nav("/community?tab=chat");await until("Boolean(document.querySelector('.private-conversation'))");
  assert(await evaluate("document.querySelector('.private-chat-header').innerText.includes('双向选择已解锁')"),"Private chat clearly identifies mutual match without fabricated online status");
  await capture("private-chat-desktop");
  const originalCount=db.prepare("SELECT COUNT(*) AS n FROM messages").get().n;
  await click("document.querySelector('.private-topic-toggle')");
  assert(await evaluate("document.querySelectorAll('.private-topic-cards button').length===3&&document.querySelectorAll('.private-topic-categories button[aria-pressed]').length===4"),"Icebreaker panel offers four categories and three suggestions");
  await click("Array.from(document.querySelectorAll('.private-topic-categories button')).find(item=>item.innerText==='兴趣交换')");
  assert(await evaluate("document.querySelector('.private-topic-cards').innerText.includes('摄影')"),"Shared public interest personalizes one suggestion");
  const firstTopic=await evaluate("document.querySelector('.private-topic-cards button').innerText");
  await click("document.querySelector('.private-refresh-topics')");
  assert(await evaluate("document.querySelector('.private-topic-cards button').innerText!=="+JSON.stringify(firstTopic)),"User can refresh icebreaker suggestions");
  await click("document.querySelector('.private-topic-cards button')");
  assert(await evaluate("document.querySelector('#private-message-input').value.length>0")&&db.prepare("SELECT COUNT(*) AS n FROM messages").get().n===originalCount,"Picking an icebreaker only fills the draft and never sends automatically");
  await capture("private-chat-icebreakers");
  await click("document.querySelector('.private-composer button[type=submit]')");
  await until("document.querySelector('#private-message-input').value===''");
  assert(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n===originalCount+1,"Explicit send saves exactly one real private message");
  await input("#private-message-input","尚未发送的私人草稿","HTMLTextAreaElement");
  await nav("/community?tab=plaza");await nav("/community?tab=chat");
  assert(await evaluate("document.querySelector('#private-message-input').value==='尚未发送的私人草稿'"),"Chat draft restores within this tab and is scoped to account and conversation");
  await evaluate("document.querySelector('#private-message-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}))");
  await pause(200);
  assert(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n===originalCount+1,"Enter during Chinese input composition does not submit");
  await input("#private-message-input","第一行\n第二行","HTMLTextAreaElement");
  await evaluate("document.querySelector('#private-message-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}))");
  assert(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n===originalCount+1,"Shift Enter keeps a multiline draft without sending");
  await send("Network.emulateNetworkConditions",{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await click("document.querySelector('.private-composer button[type=submit]')");
  await until("Boolean(document.querySelector('.private-send-error'))");
  assert(await evaluate("document.querySelector('#private-message-input').value==='第一行\\n第二行'"),"Failed send retains the complete multiline draft with a visible retry message");
  await send("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await click("document.querySelector('#private-message-input')");
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
  await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
  await until("document.querySelector('#private-message-input').value===''");
  assert(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n===originalCount+2&&db.prepare("SELECT body FROM messages ORDER BY id DESC LIMIT 1").get().body==="第一行\n第二行","Enter submits the preserved draft after connection returns");
  const match=db.prepare("SELECT id FROM matches WHERE user_a_id='user-a' OR user_b_id='user-a' LIMIT 1").get();
  const add=db.prepare("INSERT INTO messages(match_id,sender_id,body,status,created_at) VALUES (?,? ,?,'sent',?)");
  for(let index=0;index<35;index++)add.run(match.id,index%2?"user-a":"user-b","本地长对话布局测试 "+index+"。这是一段虚构的校园日常分享。",new Date(Date.now()+index*1000).toISOString());
  await until("document.querySelectorAll('.private-message').length>=39");
  await evaluate("(()=>{const feed=document.querySelector('.private-message-feed');feed.scrollTop=0;feed.dispatchEvent(new Event('scroll',{bubbles:true}));})()");
  await pause(200);add.run(match.id,"user-b","新的来信不会打断你",new Date(Date.now()+40000).toISOString());
  await until("Boolean(document.querySelector('.private-new-messages'))");
  assert(await evaluate("document.querySelector('.private-message-feed').scrollTop<80"),"Incoming messages do not pull the reader away from earlier messages");
  await click("document.querySelector('.private-new-messages')");
  assert(await evaluate("!document.querySelector('.private-new-messages')"),"New-message control returns to the latest message");
  for(const width of [390,320]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height:844,deviceScaleFactor:1,mobile:true});await pause(300);
    assert(await evaluate("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.private-message-feed').clientHeight>100"),width+"px chat has no horizontal overflow and keeps a usable message viewport");
    await evaluate("document.querySelector('.private-conversation').scrollIntoView({block:'start',behavior:'instant'})");await capture("private-chat-mobile-"+width);
  }
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await nav("/account");await until("Boolean(document.querySelector('.account-delete-card'))");
  assert(await evaluate("document.body.innerText.includes('账号与隐私')&&document.body.innerText.includes('历史备份')"),"Deletion page explains the account impact and retained records");
  await capture("account-settings-desktop");
  await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('申请注销'))");
  await until("Boolean(document.querySelector('.account-delete-dialog'))");
  assert(await evaluate("Array.from(document.querySelectorAll('.account-delete-dialog button')).find(item=>item.innerText==='确认注销').disabled"),"Deletion stays disabled before email code, typed confirmation and acknowledgement");
  await click("Array.from(document.querySelectorAll('.account-delete-dialog button')).find(item=>item.innerText==='保留账号')");
  assert(db.prepare("SELECT status FROM users WHERE id='user-a'").get().status==="active","Canceling deletion leaves the account and data unchanged");
  await click("Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('申请注销'))");
  await click("Array.from(document.querySelectorAll('.account-delete-dialog button')).find(item=>item.innerText.includes('获取注销验证码'))");
  await until("document.querySelector('.account-delete-dialog').innerText.includes('本地演示注销验证码')");
  const deletionCode=await evaluate("document.querySelector('.account-delete-dialog').innerText.match(/本地演示注销验证码：(\\d{6})/)[1]");
  await input("#account-delete-code",deletionCode);
  await input("#account-delete-confirmation","注销账号");
  await click("document.querySelector('.account-delete-dialog input[type=checkbox]')");
  for(const width of [390,320]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height:844,deviceScaleFactor:1,mobile:true});await pause(250);
    assert(await evaluate("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.account-delete-dialog').getBoundingClientRect().width<=innerWidth"),width+"px account deletion confirmation fits the screen");
    await capture("account-delete-mobile-"+width);
  }
  await click("Array.from(document.querySelectorAll('.account-delete-dialog button')).find(item=>item.innerText==='确认注销')");
  await until("location.pathname==='/'&&new URLSearchParams(location.search).get('account')==='deleted'");
  assert(db.prepare("SELECT status FROM users WHERE id='user-a'").get().status==="deleted","Explicit confirmation completes deletion of the local synthetic account");
  assert(!(await send("Network.getCookies",{urls:[base]})).cookies.some(item=>item.name==="tongpin_session"||item.name==="tongpin_community"),"Deletion clears authentication and browsing credentials");
  assert(await evaluate("!Object.keys(sessionStorage).some(key=>key.startsWith('tongpin-chat-draft-v1:user-a:'))"),"Deleted account's chat drafts are cleared from this browser");
  assert(errors.length===0,"No uncaught browser exceptions during chat and account deletion");
  writeFileSync(path.join(qa,"checks.json"),JSON.stringify({checks,errors},null,2));console.log("Screenshots: "+qa);
}catch(error){if(capture)await capture("failure");throw error;}
finally{if(ws)ws.close();if(browser)browser.kill();server.kill();db.close();}
