// Uses a disposable local copy of verify-social-flow's fixture. Never production.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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
const review = (id, status, extra = {}) => json("/api/admin", a, { action: "review_verification", requestId: id, status, checks: ["official", "identity", "enrolled"], note: "本地虚构夹具核验结论", validUntil: new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10), ...extra });
let challengeToken;
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ method: "chsi_code", university: "本地虚构测试大学", name: "测试学生", studentNumber: "LOCAL2026001", enrollmentUntil: "2030-06-30", identifier: "TESTONLYCODE2026", consent: "true", challengeToken, ...extra })) data.set(key, value);
  return data;
}
try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 350)); }
  const sent = await json("/api/auth/email/send", "", { email: "student-proof@example.com" });
  const signed = await json("/api/auth/email/verify", "", { email: "student-proof@example.com", code: sent.payload.data.demoCode });
  const c = signed.response.headers.get("set-cookie").split(";")[0];
  const user = db.prepare("SELECT id FROM users WHERE email='student-proof@example.com'").get();
  assert((await request("/api/verification")).response.status === 401, "Guests cannot retrieve account verification state");
  assert((await request("/api/verification", "", { method: "POST", body: form() })).response.status === 401, "Guests cannot submit evidence");
  assert((await request("/api/admin/verification?id=1")).response.status === 401, "Evidence endpoint requires login");
  assert((await request("/api/admin/verification?id=1", b)).response.status === 403, "Other students cannot read any evidence");
  assert((await json("/api/onboarding", c, { action: "submit_verification", method: "student_card", university: "伪造学校", identifier: "1234" })).response.status === 400, "Legacy text-only submission endpoint is closed");
  const emailSent = await json("/api/onboarding", c, { action: "send_code", email: "proof@local.edu.cn" });
  const emailBound = await json("/api/onboarding", c, { action: "verify_code", email: "proof@local.edu.cn", code: emailSent.payload.data.demoCode, university: "本地虚构测试大学" });
  assert(emailBound.response.ok && emailBound.payload.data.verified === false && db.prepare("SELECT campus_verified FROM users WHERE id=?").get(user.id).campus_verified === 0, "Campus mailbox possession alone never approves current enrollment");
  const state = await request("/api/verification", c); challengeToken = state.payload.data.challenge.token;
  assert(state.response.headers.get("cache-control").includes("no-store") && !JSON.stringify(state.payload).includes("studentNumber"), "Student state contains no evidence and is not cached");
  assert((await request("/api/verification", c, { method: "POST", body: form({ consent: "false" }) })).response.status === 400, "Evidence processing requires explicit consent");
  assert((await request("/api/verification", c, { method: "POST", body: form({ identifier: "1234" }) })).response.status === 400, "Short arbitrary text is not a report code");
  const otherState = await request("/api/verification", b);
  assert((await request("/api/verification", c, { method: "POST", body: form({ challengeToken: otherState.payload.data.challenge.token }) })).response.status === 400, "A challenge signed for another account is rejected");
  assert((await request("/api/verification", c, { method: "POST", body: form({ method: "student_card", identifier: "" }) })).response.status === 400, "Student card needs both actual images");
  const created = await request("/api/verification", c, { method: "POST", body: form({ identifier: "LOCALREPORT2026A" }) });
  assert(created.response.ok && created.payload.data.status === "pending", "CHSI application waits for human review");
  let row = db.prepare("SELECT * FROM verification_requests WHERE user_id=? ORDER BY id DESC LIMIT 1").get(user.id);
  assert(row.encrypted_evidence && !row.encrypted_evidence.includes("LOCAL2026001") && !row.encrypted_evidence.includes("LOCALREPORT2026A") && !row.identifier.includes("LOCAL2026001"), "Full student details and report code are encrypted at rest");
  assert((await request("/api/verification", c, { method: "POST", body: form({ identifier: "LOCALREPORT2026A" }) })).response.status === 400, "Only one pending application is allowed per account");
  assert((await request("/api/verification", b, { method: "POST", body: form({ challengeToken: otherState.payload.data.challenge.token, identifier: "LOCALREPORT2026A", studentNumber: "LOCAL2026002" }) })).response.status === 400, "Report code cannot be shared across different accounts");
  assert((await review(row.id, "approved")).response.status === 400, "Admin must first open the submitted original evidence");
  const evidence = await request(`/api/admin/verification?id=${row.id}`, a);
  assert(evidence.response.ok && evidence.payload.data.studentNumber === "LOCAL2026001" && evidence.response.headers.get("cache-control").includes("no-store"), "Only owner admin can open decrypted evidence with no-store");
  const dashboard = await request("/admin", a);
  assert(!dashboard.payload.includes("LOCALREPORT2026A") && !dashboard.payload.includes(row.encrypted_evidence), "Admin list does not preload report codes or ciphertext");
  assert((await review(row.id, "approved", { checks: [] })).response.status === 400, "Approval requires the method-specific checklist");
  assert((await review(row.id, "approved", { validUntil: "2030-06-30" })).response.status === 400, "Admin cannot grant indefinite enrollment approval");
  assert((await review(row.id, "rejected", { note: "" })).response.status === 400, "A rejection needs an explanation for the applicant");
  const accepted = await review(row.id, "approved");
  assert(accepted.response.ok && db.prepare("SELECT campus_verified,verified_until FROM users WHERE id=?").get(user.id).campus_verified === 1, "Completed review grants a bounded certification");
  assert(db.prepare("SELECT encrypted_evidence FROM verification_requests WHERE id=?").get(row.id).encrypted_evidence === null && (await request(`/api/admin/verification?id=${row.id}`, a)).response.status === 400, "Original evidence is deleted after review and cannot be reopened");
  assert((await review(row.id, "rejected")).response.status === 400, "A completed application cannot be reviewed again");
  assert((await request("/api/verification", c)).payload.data.latest.review_note === "本地虚构夹具核验结论", "Applicant can read their own review outcome and explanation");
  // Seed complete profile/preferences only in this local fixture to test expiry gates.
  db.prepare("UPDATE users SET questionnaire_completed=1,verified_until=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), user.id);
  db.prepare("UPDATE profiles SET gender='女生',grade='大三',major='测试',bio='本地测试',personality_type='INFP' WHERE user_id=?").run(user.id);
  db.prepare("INSERT INTO questionnaire_answers(user_id,question_id,dimension,answer,updated_at) SELECT ?,question_id,dimension,answer,updated_at FROM questionnaire_answers WHERE user_id='user-a'").run(user.id);
  assert((await json("/api/companions", c, { companionId: "official-xiaotong", action: "start", sceneId: "class-break", revision: 0 })).response.status === 403, "Expired certification blocks interaction even with complete profile and questionnaire");
  const priorMatch = db.prepare("SELECT id FROM matches WHERE user_a_id='user-b' OR user_b_id='user-b' LIMIT 1").get();
  db.prepare("UPDATE users SET verified_until=? WHERE id='user-b'").run(new Date(Date.now() - 1000).toISOString());
  assert((await request('/api/matches', a)).payload.data.candidate === null, "Expired students are removed from current real matching cards");
  assert((await json('/api/matches', a, {matchId: priorMatch.id, intent:'interested'})).response.status === 400, "A valid student cannot confirm a stale match against an expired student");
  assert((await json('/api/messages', a, {matchId: priorMatch.id, body:'不能发给过期认证'})).response.status === 400, "Valid sender cannot send new private messages to an expired recipient");
  db.prepare("UPDATE users SET verified_until=NULL WHERE id='user-b'").run();
  const freshChallenge = (await request("/api/verification", c)).payload.data.challenge.token;
  const image = await sharp({ create: { width: 600, height: 450, channels: 3, background: "#aaccaa" } }).jpeg().toBuffer();
  const card = form({ method: "student_card", challengeToken: freshChallenge, identifier: "" });
  card.set("identityPhoto", new File([image], "synthetic-card.jpg", { type: "image/jpeg" })); card.set("enrollmentPhoto", new File([image], "synthetic-registration.jpg", { type: "image/jpeg" }));
  assert((await request("/api/verification", c, { method: "POST", body: card })).response.ok, "Renewal can submit two real image files without public uploads");
  row = db.prepare("SELECT * FROM verification_requests WHERE user_id=? ORDER BY id DESC LIMIT 1").get(user.id);
  const cardEvidence = await request(`/api/admin/verification?id=${row.id}`, a);
  assert(cardEvidence.payload.data.images.length === 2 && cardEvidence.payload.data.images.every(value => value.startsWith("data:image/jpeg;base64,")), "Admin sees sanitized image data and the account challenge");
  assert((await review(row.id, "approved")).response.status === 400, "Student-card checklist specifically requires the handwritten challenge check");
  assert((await review(row.id, "rejected", { note: "请补拍本学期清晰注册章" })).response.ok, "Admin can return unclear student-card evidence with a precise reason");
  assert(db.prepare("SELECT encrypted_evidence FROM verification_requests WHERE id=?").get(row.id).encrypted_evidence === null, "Rejected card photos are deleted immediately");
  assert((await request("/api/verification", c, { method: "POST", body: form({ challengeToken: freshChallenge, identifier: "LOCALREPORT2026B" }) })).response.ok, "Rejected applicant can resubmit new evidence");
  const currentId = db.prepare("SELECT MAX(id) AS id FROM verification_requests WHERE user_id=?").get(user.id).id;
  assert((await request("/api/verification", c, { method: "DELETE" })).response.ok && db.prepare("SELECT encrypted_evidence,status FROM verification_requests WHERE id=?").get(currentId).status === "withdrawn", "Applicant can withdraw their pending application and delete originals");
  await request("/api/verification", c, { method: "POST", body: form({ challengeToken: freshChallenge, identifier: "LOCALREPORT2026C" }) });
  db.prepare("UPDATE verification_requests SET evidence_expires_at=? WHERE user_id=? AND status='pending'").run(new Date(Date.now() - 1000).toISOString(), user.id);
  const expired = await request("/api/verification", c);
  assert(expired.payload.data.latest.status === "rejected" && db.prepare("SELECT encrypted_evidence FROM verification_requests WHERE id=?").get(expired.payload.data.latest.id).encrypted_evidence === null, "Unreviewed evidence expires after the retention window and is purged on access");
  assert(db.prepare("SELECT campus_verified,verified_until FROM users WHERE id='user-a'").get().campus_verified === 1 && (await request("/admin", a)).payload.includes("旧版认证"), "Existing approvals retain access and are clearly flagged for individual re-review");
  const logoutToken = "local-logout-regression";
  db.prepare("INSERT INTO auth_sessions(id,user_id,expires_at,created_at,last_seen_at) VALUES (?,'user-a',?,?,?)").run(createHash("sha256").update(logoutToken).digest("hex"), new Date(Date.now() + 86400_000).toISOString(), new Date().toISOString(), new Date().toISOString());
  const logout = await request("/logout", `tongpin_session=${logoutToken}`, { headers: { host: "0.0.0.0:10000", "x-forwarded-host": "untrusted.invalid", "x-forwarded-proto": "https" } });
  assert(logout.response.status === 303 && logout.response.headers.get("location") === "/", "Logout behind an internal proxy returns a relative 303 home redirect");
  assert(logout.response.headers.get("set-cookie").includes("Max-Age=0") && !db.prepare("SELECT id FROM auth_sessions WHERE id=?").get(createHash("sha256").update(logoutToken).digest("hex")), "Logout deletes the server session and browser cookie");
  for (const target of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid"]) assert((await request(`/logout?return_to=${encodeURIComponent(target)}`)).response.headers.get("location") === "/", "Logout rejects an external or protocol-relative return path");
  assert((await request("/logout?return_to=%2Fcommunity%3Ftab%3Dplaza")).response.headers.get("location") === "/community?tab=plaza", "A safe local return path remains available");
  writeFileSync(path.join(directory, "checks.json"), JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2));
} catch (error) { console.error(logs); throw error; }
finally { server.kill(); db.close(); }
