// Uses a disposable local copy of verify-social-flow's fixture. Never production.
import { spawn } from "node:child_process";
import { DatabaseSync, backup } from "node:sqlite";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd(), directory = path.join(root, ".tmp/student-verification-qa"), base = "http://127.0.0.1:3919";
mkdirSync(directory, { recursive: true });
const original = new DatabaseSync(path.join(root, ".tmp/social-flow-verification/test.sqlite"), { readOnly: true });
const database = path.join(directory, "test.sqlite"); await backup(original, database); original.close();
const db = new DatabaseSync(database), checks = [];
for (const name of ["drizzle", "public", ".next/static"]) cpSync(path.join(root, name), path.join(root, ".next/standalone", name), { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: database, DATABASE_PROVIDER: "sqlite", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_CODE_SECRET: "test-only-secret-that-is-long-enough-2026", AUTH_COOKIE_SECURE: "false", ADMIN_EMAIL: "a@example.edu.cn", DEMO_SEED_ENABLED: "false", AUTH_ALLOW_DEMO_CODES: "true", RESEND_API_KEY: "", EMAIL_FROM: "", PORT: "3919", HOSTNAME: "0.0.0.0" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; server.stderr.on("data", value => { logs += value; });
const a = "tongpin_session=social-flow-user-a", b = "tongpin_session=social-flow-user-b";
const assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); console.log("PASS " + name); };
async function request(url, cookie = "", options = {}) {
  const response = await fetch(base + url, { redirect: "manual", ...options, headers: { cookie, ...options.headers } });
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}
const json = (url, cookie, body) => request(url, cookie, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const review=(id,status,extra={})=>json("/api/admin",a,{action:"review_verification",requestId:id,status,...extra});
function form(extra={}) {const data=new FormData();for(const [key,value] of Object.entries({method:"chsi_code",university:"本地测试大学",identifier:"LOCALREPORT2026A",consent:"true",...extra}))data.set(key,value);return data;}
async function login(email) {const sent=await json("/api/auth/email/send","",{email});const signed=await json("/api/auth/email/verify","",{email,code:sent.payload.data.demoCode});return {cookie:signed.response.headers.get("set-cookie").split(";")[0],id:db.prepare("SELECT id FROM users WHERE email=?").get(email).id};}
async function sendCampus(cookie,email) {return json("/api/onboarding",cookie,{action:"send_code",email});}
async function verifyCampus(cookie,email,code,university="本地测试大学") {return json("/api/onboarding",cookie,{action:"verify_code",email,code,university});}
try {
  for(let i=0;i<90;i++){try{if((await fetch(base+"/login")).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,350));}
  const student=await login("simple-student@example.com"),manual=await login("simple-manual@example.com"),c=student.cookie,d=manual.cookie;
  assert((await request("/api/verification")).response.status===401,"Guests cannot access account verification state");
  assert((await request("/api/verification","",{method:"POST",body:form()})).response.status===401,"Guests cannot submit evidence");
  assert((await request("/api/admin/verification?id=1")).response.status===401,"Evidence requires login");
  assert((await request("/api/admin/verification?id=1",b)).response.status===403,"Other students cannot read evidence");
  assert((await sendCampus(c,"ordinary@qq.com")).response.status===400,"Ordinary mailbox cannot be used as a campus mailbox");
  const sent=await sendCampus(c,"simple@local.edu.cn"),code=sent.payload.data.demoCode;
  assert(sent.response.ok&&code,"Campus verification sends a code in the local fixture");
  const stored=db.prepare("SELECT * FROM login_codes WHERE channel=? ORDER BY id DESC LIMIT 1").get("campus:"+student.id);
  assert(stored.code_hash!==code&&stored.code_hash.length===64,"Campus code is stored as an account-bound hash");
  assert((await sendCampus(c,"second@local.edu.cn")).response.status===400,"Campus code sending has a per-account cooldown");
  assert((await verifyCampus(d,"simple@local.edu.cn",code)).response.status===400,"Another account cannot use a campus code");
  const wrong=code==="111111"?"222222":"111111";
  assert((await verifyCampus(c,"simple@local.edu.cn",wrong)).response.status===400,"Incorrect campus code is rejected");
  const accepted=await verifyCampus(c,"simple@local.edu.cn",code);
  const certified=db.prepare("SELECT * FROM users WHERE id=?").get(student.id);
  assert(accepted.response.ok&&accepted.payload.data.verified&&certified.campus_verified===1&&certified.verification_method==="campus_email","Correct campus code directly grants campus email certification");
  assert(new Date(certified.verified_until)>new Date()&&new Date(certified.verified_until)<new Date(Date.now()+181*86400000),"Campus certification validity is maintained automatically");
  assert(!db.prepare("SELECT id FROM verification_requests WHERE user_id=?").get(student.id),"Campus email approval requires no manual application");
  assert((await verifyCampus(c,"simple@local.edu.cn",code)).response.status===400,"Consumed campus code cannot be replayed");
  assert((await sendCampus(b,"simple@local.edu.cn")).response.status===400,"One campus mailbox cannot bind multiple accounts");
  const attempt=await sendCampus(b,"attempts@local.edu.cn"),right=attempt.payload.data.demoCode,bad=right==="111111"?"222222":"111111";
  for(let i=0;i<5;i++)await verifyCampus(b,"attempts@local.edu.cn",bad);
  assert((await verifyCampus(b,"attempts@local.edu.cn",right)).response.status===400,"Five wrong attempts disable a campus code even if later guessed correctly");
  assert(db.prepare("SELECT campus_verified FROM users WHERE id='user-b'").get().campus_verified===1,"Failed verification never removes a previous approval");
  db.prepare("UPDATE login_codes SET created_at=? WHERE channel='campus:user-b'").run(new Date(Date.now()-120000).toISOString());
  const resent=await sendCampus(b,"attempts@local.edu.cn");
  assert(resent.response.ok&&!db.prepare("SELECT id FROM login_codes WHERE id=? AND consumed_at IS NULL").get(db.prepare("SELECT id FROM login_codes WHERE channel='campus:user-b' ORDER BY id ASC LIMIT 1").get().id),"Resending replaces the older campus code");
  assert((await verifyCampus(b,"attempts@local.edu.cn",resent.payload.data.demoCode,"测试高校")).response.ok,"Fresh campus code works after cooldown");
  const state=await request("/api/verification",d);
  assert(state.response.headers.get("cache-control").includes("no-store")&&!JSON.stringify(state.payload).includes("challenge"),"Manual application no longer requires a challenge token");
  assert((await request("/api/verification",d,{method:"POST",body:form({consent:"false"})})).response.status===400,"Private materials still require consent");
  assert((await request("/api/verification",d,{method:"POST",body:form({identifier:"1234"})})).response.status===400,"Arbitrary short text is not a report code");
  const minimal=await request("/api/verification",d,{method:"POST",body:form()});
  assert(minimal.response.ok&&minimal.payload.data.status==="pending","School and report code alone are enough to submit CHSI review");
  let row=db.prepare("SELECT * FROM verification_requests WHERE user_id=? ORDER BY id DESC LIMIT 1").get(manual.id);
  assert(row.evidence_version===2&&!row.encrypted_evidence.includes("LOCALREPORT2026A")&&row.enrollment_until===null,"Minimal report evidence remains encrypted without repeated personal fields");
  assert(db.prepare("SELECT campus_verified FROM users WHERE id=?").get(manual.id).campus_verified===0,"Manual evidence still waits for actual administrator approval");
  assert((await request("/api/verification",d,{method:"POST",body:form()})).response.status===400,"Duplicate pending applications are rejected");
  assert((await request("/api/verification",b,{method:"POST",body:form()})).response.status===400,"Same report code cannot be claimed by another account");
  assert((await review(row.id,"approved")).response.status===400,"Admin must open actual evidence before approving");
  const evidence=await request("/api/admin/verification?id="+row.id,a);
  assert(evidence.response.ok&&evidence.payload.data.code==="LOCALREPORT2026A"&&evidence.response.headers.get("cache-control").includes("no-store"),"Only owner can open original report code privately");
  const dashboard=await request("/admin",a);
  assert(!dashboard.payload.includes("LOCALREPORT2026A")&&!dashboard.payload.includes(row.encrypted_evidence),"Admin list does not preload original materials");
  assert((await review(row.id,"rejected")).response.status===400,"Returning an application still needs a useful reason");
  const reviewed=await review(row.id,"approved");
  assert(reviewed.response.ok&&reviewed.payload.data.verifiedUntil,"Admin can approve without checklists, repeated notes or dates");
  assert(db.prepare("SELECT encrypted_evidence FROM verification_requests WHERE id=?").get(row.id).encrypted_evidence===null,"Original evidence is deleted immediately after review");
  assert((await review(row.id,"approved")).response.status===400,"Completed application cannot be reviewed again");
  assert((await request("/api/verification",d)).payload.data.latest.review_note==="高校身份材料审核通过","Applicant receives an automatic clear approval note");
  db.prepare("UPDATE users SET questionnaire_completed=1,verified_until=? WHERE id=?").run(new Date(Date.now()-1000).toISOString(),manual.id);
  db.prepare("UPDATE profiles SET gender='女生',grade='大三',major='测试',bio='本地测试',personality_type='INFP' WHERE user_id=?").run(manual.id);
  db.prepare("INSERT INTO questionnaire_answers(user_id,question_id,dimension,answer,updated_at) SELECT ?,question_id,dimension,answer,updated_at FROM questionnaire_answers WHERE user_id='user-a'").run(manual.id);
  assert((await json("/api/companions",d,{companionId:"official-xiaotong",action:"start",sceneId:"class-break",revision:0})).response.status===403,"Expired certification still blocks participation");
  assert((await request("/api/verification",d,{method:"POST",body:form({method:"student_card",identifier:""})})).response.status===400,"A student-card application requires an actual image");
  const image=await sharp({create:{width:600,height:450,channels:3,background:"#aaccaa"}}).jpeg().toBuffer();
  const card=form({method:"student_card",identifier:""});card.set("identityPhoto",new File([image],"synthetic-card.jpg",{type:"image/jpeg"}));
  assert((await request("/api/verification",d,{method:"POST",body:card})).response.ok,"One student-card photo and school suffice without handwritten token or extra documents");
  row=db.prepare("SELECT * FROM verification_requests WHERE user_id=? ORDER BY id DESC LIMIT 1").get(manual.id);
  const duplicate=form({method:"student_card",identifier:""});duplicate.set("identityPhoto",new File([image],"copy.jpg",{type:"image/jpeg"}));
  assert((await request("/api/verification",b,{method:"POST",body:duplicate})).response.status===400,"An identical student-card image cannot be reused across accounts");
  const cardEvidence=await request("/api/admin/verification?id="+row.id,a);
  assert(cardEvidence.payload.data.images.length===1&&cardEvidence.payload.data.images[0].startsWith("data:image/jpeg;base64,"),"Admin receives one sanitized private photo");
  assert((await review(row.id,"rejected",{note:"照片模糊，请重新上传"})).response.ok,"Admin can return an unclear photo with a short explanation");
  assert(db.prepare("SELECT encrypted_evidence FROM verification_requests WHERE id=?").get(row.id).encrypted_evidence===null,"Returned photos are deleted");
  const older=form({identifier:"LOCALREPORT2026B"});
  assert((await request("/api/verification",d,{method:"POST",body:older})).response.ok,"Returned applicant can resubmit");
  row=db.prepare("SELECT * FROM verification_requests WHERE user_id=? ORDER BY id DESC LIMIT 1").get(manual.id);
  db.prepare("UPDATE verification_requests SET evidence_version=1,enrollment_until='2030-06-30' WHERE id=?").run(row.id);
  assert((await request("/api/admin/verification?id="+row.id,a)).response.ok&&(await review(row.id,"approved")).response.ok,"Previous encrypted evidence format remains reviewable with the simpler controls");
  await request("/api/verification",d,{method:"POST",body:form({identifier:"LOCALREPORT2026C"})});
  row=db.prepare("SELECT * FROM verification_requests WHERE user_id=? ORDER BY id DESC LIMIT 1").get(manual.id);
  const mail=await sendCampus(d,"switch@local.edu.cn");
  assert((await verifyCampus(d,"switch@local.edu.cn",mail.payload.data.demoCode)).response.ok,"Pending applicant can use campus email instead of waiting");
  const replaced=db.prepare("SELECT status,encrypted_evidence FROM verification_requests WHERE id=?").get(row.id);
  assert(replaced.status==="withdrawn"&&replaced.encrypted_evidence===null,"Email approval closes the pending manual application and deletes its materials");
  assert((await review(row.id,"approved")).response.status===400,"Old manual application cannot overwrite newer email approval");
  await request("/api/verification",d,{method:"POST",body:form({identifier:"LOCALREPORT2026D"})});
  assert((await request("/api/verification",d,{method:"DELETE"})).response.ok,"Applicant can still withdraw materials");
  await request("/api/verification",d,{method:"POST",body:form({identifier:"LOCALREPORT2026E"})});
  db.prepare("UPDATE verification_requests SET evidence_expires_at=? WHERE user_id=? AND status='pending'").run(new Date(Date.now()-1000).toISOString(),manual.id);
  assert((await request("/api/verification",d)).payload.data.latest.status==="rejected","Unreviewed materials still expire and are cleaned on access");
  assert(db.prepare("SELECT campus_verified FROM users WHERE id=?").get(manual.id).campus_verified===1,"Expired extra application does not remove existing email approval");
  assert(db.prepare("SELECT campus_verified FROM users WHERE id='user-a'").get().campus_verified===1,"Existing legacy approvals remain intact");
  const logout=await request("/logout", "",{headers:{host:"0.0.0.0:10000","x-forwarded-proto":"https"}});
  assert(logout.response.status===303&&logout.response.headers.get("location")==="/","Logout still redirects to a relative public home URL");
  writeFileSync(path.join(directory,"checks.json"),JSON.stringify({checkedAt:new Date().toISOString(),checks},null,2));
}catch(error){console.error(logs);throw error;}
finally{server.kill();db.close();}
