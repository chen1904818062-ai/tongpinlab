// Uses a disposable local copy of verify-social-flow's fixture. Never production.
import { spawn } from "node:child_process";
import { DatabaseSync, backup } from "node:sqlite";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd(), directory = path.join(root, ".tmp/account-chat-qa"), base = "http://127.0.0.1:3920";
mkdirSync(directory, { recursive: true });
const original = new DatabaseSync(path.join(root, ".tmp/social-flow-verification/test.sqlite"), { readOnly: true });
const database = path.join(directory, "test.sqlite"); await backup(original, database); original.close();
const db = new DatabaseSync(database), checks = [];
for (const name of ["drizzle", "public", ".next/static"]) cpSync(path.join(root, name), path.join(root, ".next/standalone", name), { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: database, DATABASE_PROVIDER: "sqlite", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026", AUTH_COOKIE_SECURE: "false", ADMIN_EMAIL: "a@example.edu.cn", DEMO_SEED_ENABLED: "false", AUTH_ALLOW_DEMO_CODES: "true", RESEND_API_KEY: "", EMAIL_FROM: "", PORT: "3920", HOSTNAME: "0.0.0.0" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; server.stderr.on("data", value => { logs += value; });
const a = "tongpin_session=social-flow-user-a", b = "tongpin_session=social-flow-user-b";
const assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); console.log("PASS " + name); };
async function request(url, cookie = "", options = {}) {
  const response = await fetch(base + url, { redirect: "manual", ...options, headers: { cookie, ...options.headers } });
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}
const json = (url, cookie, body) => request(url, cookie, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });


const account=(cookie,action,extra={})=>json("/api/account",cookie,{action,...extra});
const counts=(id)=>Object.fromEntries([["profiles","user_id"],["auth_sessions","user_id"],["questionnaire_answers","user_id"],["verification_requests","user_id"],["verification_codes","user_id"],["avatar_images","user_id"],["companion_experiences","user_id"],["messages","sender_id"],["plaza_comments","author_id"],["plaza_likes","user_id"]].map(([table,column])=>[table,Number(db.prepare("SELECT COUNT(*) AS n FROM "+table+" WHERE "+column+"=?").get(id).n)]));
async function fresh(email){const sent=await json("/api/auth/email/send","",{email});const r=await json("/api/auth/email/verify","",{email,code:sent.payload.data.demoCode});return {cookie:r.response.headers.get("set-cookie").split(";")[0],id:db.prepare("SELECT id FROM users WHERE email=?").get(email).id};}
try {
  for(let i=0;i<90;i++){try{if((await fetch(base+"/login")).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,350));}
  assert((await account("","send_delete_code")).response.status===401,"Anonymous visitor cannot send deletion code");
  assert((await account("","delete_account",{code:"123456",confirmation:"注销账号"})).response.status===401,"Anonymous visitor cannot delete accounts");
  assert((await request("/account")).response.status===307,"Account privacy page requires login");
  const c=await fresh("deletion-test@example.com");
  assert((await request("/account",c.cookie)).payload.includes("账号与隐私"),"Unverified new account can access its own deletion page");
  const cSent=await account(c.cookie,"send_delete_code"),cCode=cSent.payload.data.demoCode;
  assert(cSent.response.ok&&cCode,"Deletion requires a new purpose-specific email code");
  for(let i=0;i<5;i++)await account(c.cookie,"delete_account",{code:cCode==="111111"?"222222":"111111",confirmation:"注销账号"});
  assert((await account(c.cookie,"delete_account",{code:cCode,confirmation:"注销账号"})).response.status===400,"Five incorrect attempts disable the deletion code");
  assert(db.prepare("SELECT status FROM users WHERE id=?").get(c.id).status==="active","Wrong codes do not change the account");
  const sent=await account(a,"send_delete_code",{email:"b@example.edu.cn",userId:"user-b"}),code=sent.payload.data.demoCode;
  const proof=db.prepare("SELECT * FROM login_codes WHERE channel='account_delete:user-a' ORDER BY id DESC LIMIT 1").get();
  assert(sent.response.ok&&proof.destination==="a@example.edu.cn"&&proof.code_hash!==code,"Code is hashed and always sent to the current account email, ignoring submitted identity");
  assert((await account(a,"send_delete_code")).response.status===400,"Deletion code sending has a cooldown");
  assert((await account(b,"delete_account",{code,confirmation:"注销账号",userId:"user-a"})).response.status===400,"One account cannot use another account deletion code");
  assert((await account(a,"delete_account",{code,confirmation:"退出登录"})).response.status===400,"Explicit deletion phrase is required independently of the code");
  assert(!db.prepare("SELECT consumed_at FROM login_codes WHERE id=?").get(proof.id).consumed_at,"Missing confirmation does not consume a valid code");
  const match=db.prepare("SELECT id FROM matches WHERE user_a_id='user-a' OR user_b_id='user-a' LIMIT 1").get();
  assert((await json("/api/messages",c.cookie,{matchId:match.id,body:"不能绕过认证"})).response.status===403,"Incomplete student still cannot send private messages");
  assert((await json("/api/messages",b,{matchId:999999,body:"不能猜测私信"})).response.status===400,"Guessing a conversation id cannot send a message");
  const beforeMessages=Number(db.prepare("SELECT COUNT(*) AS n FROM messages WHERE sender_id='user-b'").get().n);
  const avatar=db.prepare("SELECT id FROM avatar_images WHERE user_id='user-a'").get().id;
  const at=new Date().toISOString();
  db.prepare("INSERT INTO verification_requests(user_id,method,university,identifier,status,created_at,evidence_version,encrypted_evidence,evidence_expires_at) VALUES ('user-a','student_card','本地测试学校','照片','pending',?,2,'synthetic-encrypted-evidence',?)").run(at,new Date(Date.now()+86400000).toISOString());
  db.prepare("INSERT INTO verification_codes(user_id,email,code,expires_at,created_at) VALUES ('user-a','test@local.edu.cn','123456',?,?)").run(new Date(Date.now()+86400000).toISOString(),at);
  const publicPost=await json("/api/plaza",a,{action:"create_post",category:"校园瞬间",audience:"public",content:"注销测试的本人公开动态"});
  const postId=publicPost.payload.data.id;
  await json("/api/plaza",a,{action:"add_comment",postId:-1002,body:"注销测试的本人评论"});
  db.exec("CREATE TRIGGER reject_test_deletion BEFORE UPDATE OF status ON users WHEN NEW.status='deleted' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  const before=counts("user-a");
  assert((await account(a,"delete_account",{code,confirmation:"注销账号"})).response.status===400,"Simulated storage failure rejects the deletion");
  assert(db.prepare("SELECT status,email FROM users WHERE id='user-a'").get().status==="active"&&JSON.stringify(before)===JSON.stringify(counts("user-a")),"Cleanup is atomic and rolls back all content/session deletions on failure");
  db.exec("DROP TRIGGER reject_test_deletion");
  db.prepare("UPDATE login_codes SET created_at=? WHERE channel='account_delete:user-a'").run(new Date(Date.now()-120000).toISOString());
  const retry=await account(a,"send_delete_code");
  const result=await account(a,"delete_account",{code:retry.payload.data.demoCode,confirmation:"注销账号",userId:"user-b",email:"b@example.edu.cn"});
  assert(result.response.ok&&result.payload.data.deleted,"Confirmed deletion succeeds only for the signed-in account");
  assert(result.response.headers.get("set-cookie").includes("tongpin_session=")&&result.response.headers.get("set-cookie").includes("tongpin_community="),"Successful deletion expires session and measured-browsing cookies");
  const removed=db.prepare("SELECT * FROM users WHERE id='user-a'").get();
  assert(removed.status==="deleted"&&removed.email===null&&removed.campus_email===null&&removed.university===null&&removed.display_name==="已注销用户"&&removed.platform_user_id==="deleted:user-a","Account identity is anonymized and cannot be matched again");
  assert(Object.values(counts("user-a")).every(value=>value===0),"Profile, sessions, certification, photo, questionnaire, companion progress, own messages and interactions are removed");
  assert(db.prepare("SELECT status,content FROM plaza_posts WHERE id=?").get(postId).status==="deleted"&&!db.prepare("SELECT content FROM plaza_posts WHERE id=?").get(postId).content.includes("本人公开动态"),"Published post content is removed from the public plaza");
  assert((await request("/uploads/avatars/"+avatar)).response.status===404,"Deleted avatar is no longer served");
  assert(db.prepare("SELECT status FROM matches WHERE id=?").get(match.id).status==="closed","All matches involving the deleted account are closed");
  assert(Number(db.prepare("SELECT COUNT(*) AS n FROM messages WHERE sender_id='user-b'").get().n)===beforeMessages,"Another student's own message records remain intact");
  assert(db.prepare("SELECT status FROM users WHERE id='user-b'").get().status==="active","Submitted userId cannot delete another user's account");
  assert((await request("/api/messages?matchId="+match.id,b)).payload.data.status==="closed","Other participant receives a closed-conversation update");
  for(const route of ["/api/messages?matchId="+match.id,"/api/matches","/api/verification"])assert((await request(route,a)).response.status===401,"Deleted account's old session is rejected: "+route);
  assert((await account(a,"send_delete_code")).response.status===401,"Deleted account cannot reuse its deletion session");
  assert(db.prepare("SELECT COUNT(*) AS n FROM users WHERE platform_user_id='email:a@example.edu.cn'").get().n===0,"Old authenticated requests cannot silently recreate the deleted identity");
  assert(db.prepare("SELECT id FROM audit_logs WHERE actor_user_id='user-a' AND action='account_deleted'").get(),"A minimal anonymous deletion audit record remains");
  const newlyRegistered=await fresh("a@example.edu.cn");
  assert(newlyRegistered.id!=="user-a"&&db.prepare("SELECT COUNT(*) AS n FROM questionnaire_answers WHERE user_id=?").get(newlyRegistered.id).n===0,"Registering the same email creates a new empty account instead of restoring deleted data");
  assert((await request("/admin",newlyRegistered.cookie)).payload.includes("平台运行情况"),"Owner email can still regain its owner role through fresh verified registration");
  writeFileSync(path.join(directory,"checks.json"),JSON.stringify({checkedAt:new Date().toISOString(),checks},null,2));
}catch(error){console.error(logs);throw error;}
finally{server.kill();db.close();}
