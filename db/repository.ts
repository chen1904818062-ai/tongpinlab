import type { AuthIdentity } from "@/lib/auth";
import { getD1 } from "@/db";
import { deliverCampusCode } from "@/lib/campus-email";
import { isAdminEmail } from "@/lib/admin";
import { assertParticipationReady } from "@/lib/participation";
import { getOfficialTopic } from "@/lib/companions";
import { getOfficialPlazaPosts } from "@/db/community";
import { allQuestions, demoCandidate, questionSections } from "@/lib/product-data";
import { validStudentCertification } from "@/lib/student-verification";
import { purgeVerificationEvidence } from "@/db/student-verification";

type RecordValue = Record<string, unknown>;

function now() {
  return new Date().toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asBool(value: unknown) {
  return Number(value) === 1;
}

export async function ensureUser(identity: AuthIdentity) {
  const db = getD1();
  let user = await db
    .prepare("SELECT * FROM users WHERE platform_user_id = ?")
    .bind(identity.userId)
    .first<RecordValue>();

  if (!user) {
    const userId = crypto.randomUUID();
    const createdAt = now();
    const role = isAdminEmail(identity.email) ? "admin" : "student";
    await db.batch([
      db.prepare(`
        INSERT INTO users (id, platform_user_id, email, display_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, identity.userId, identity.email, identity.displayName, role, createdAt, createdAt),
      db.prepare("INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)").bind(userId, createdAt),
    ]);
    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<RecordValue>();
  } else {
    await db
      .prepare("UPDATE users SET email = ?, role = ?, display_name = CASE WHEN TRIM(display_name) = '' THEN ? ELSE display_name END, updated_at = ? WHERE id = ?")
      .bind(identity.email, isAdminEmail(identity.email) ? "admin" : "student", identity.displayName, now(), user.id)
      .run();
    user = { ...user, email: identity.email, role: isAdminEmail(identity.email) ? "admin" : "student" };
  }

  if (!user) throw new Error("Unable to create user record.");
  if (process.env.DEMO_SEED_ENABLED === "true") await ensureDemoData(String(user.id));
  return normalizeUser(user);
}

async function ensureDemoData(userId: string) {
  const db = getD1();
  const createdAt = now();
  await db.batch([
    db.prepare(`
      INSERT OR IGNORE INTO users
        (id, platform_user_id, email, display_name, campus_email, campus_verified, university, verification_method, verification_status, role, onboarding_step, questionnaire_completed, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 'campus_email', 'approved', 'demo', 8, 1, 'active', ?, ?)
    `).bind(demoCandidate.id, demoCandidate.id, "demo@university.edu.cn", demoCandidate.name, "demo@university.edu.cn", demoCandidate.university, createdAt, createdAt),
    db.prepare(`
      INSERT OR IGNORE INTO profiles
        (user_id, gender, grade, major, campus, hometown, height, smoking, looking_for, bio, interests_json, photo_url, personality_type, personality_scores_json, review_status, updated_at)
      VALUES (?, '女', ?, ?, ?, ?, 165, '不吸烟', 'relationship', ?, ?, ?, ?, ?, 'approved', ?)
    `).bind(demoCandidate.id, demoCandidate.grade, demoCandidate.major, demoCandidate.campus, demoCandidate.hometown, demoCandidate.bio, JSON.stringify(demoCandidate.interests), demoCandidate.image, demoCandidate.personalityType, JSON.stringify(demoCandidate.personalityScores), createdAt),
    db.prepare(`
      INSERT OR IGNORE INTO matches
        (user_a_id, user_b_id, score, status, shared_points_json, created_at, updated_at)
      VALUES (?, ?, ?, 'suggested', ?, ?, ?)
    `).bind(userId, demoCandidate.id, demoCandidate.score, JSON.stringify(demoCandidate.reasons), createdAt, createdAt),
    db.prepare("UPDATE users SET university = ?, verification_method = 'campus_email', verification_status = 'approved' WHERE id = ?")
      .bind(demoCandidate.university, demoCandidate.id),
    db.prepare("UPDATE profiles SET photo_url = ?, personality_type = ?, personality_scores_json = ? WHERE user_id = ?")
      .bind(demoCandidate.image, demoCandidate.personalityType, JSON.stringify(demoCandidate.personalityScores), demoCandidate.id),
  ]);

  const match = await db
    .prepare("SELECT id FROM matches WHERE user_a_id = ? AND user_b_id = ?")
    .bind(userId, demoCandidate.id)
    .first<{ id: number }>();
  if (!match) return;

  await db.prepare("UPDATE matches SET score = ?, shared_points_json = ?, updated_at = ? WHERE id = ?")
    .bind(demoCandidate.score, JSON.stringify(demoCandidate.reasons), createdAt, match.id).run();

  await db.prepare(`
    INSERT OR IGNORE INTO match_intents (match_id, user_id, intent, created_at)
    VALUES (?, ?, 'interested', ?)
  `).bind(match.id, demoCandidate.id, createdAt).run();

  const existingMessage = await db
    .prepare("SELECT id FROM messages WHERE match_id = ? LIMIT 1")
    .bind(match.id)
    .first();
  if (!existingMessage) {
    await db.batch([
      db.prepare("INSERT INTO messages (match_id, sender_id, body, status, created_at) VALUES (?, ?, ?, 'read', ?)")
        .bind(match.id, demoCandidate.id, "嗨！看到我们都喜欢城市漫步，你最喜欢学校附近哪条路线？", createdAt),
      db.prepare("INSERT INTO messages (match_id, sender_id, body, status, created_at) VALUES (?, ?, ?, 'read', ?)")
        .bind(match.id, userId, "你好！我常从主楼一路走到青年湖，傍晚很舒服。", new Date(Date.now() + 1000).toISOString()),
      db.prepare("INSERT INTO messages (match_id, sender_id, body, status, created_at) VALUES (?, ?, ?, 'sent', ?)")
        .bind(match.id, demoCandidate.id, "听起来不错，下次可以交换一份校园散步地图。", new Date(Date.now() + 2000).toISOString()),
    ]);
  }

  const existingPlazaPost = await db.prepare("SELECT id FROM plaza_posts WHERE author_id = ? LIMIT 1")
    .bind(demoCandidate.id).first();
  if (!existingPlazaPost) {
    await db.batch([
      db.prepare("INSERT INTO plaza_posts (author_id, category, audience, content, status, created_at, updated_at) VALUES (?, '校园瞬间', 'national', ?, 'visible', ?, ?)")
        .bind(demoCandidate.id, "今天采访了一位毕业十年的校友。她说大学里最珍贵的不是把每一步走对，而是慢慢知道自己愿意为什么认真。想把这句话送给最近有点迷茫的你。", createdAt, createdAt),
      db.prepare("INSERT INTO plaza_posts (author_id, category, audience, content, status, created_at, updated_at) VALUES (?, '寻找同伴', 'national', ?, 'visible', ?, ?)")
        .bind(demoCandidate.id, "这周末想去看一个摄影展，再沿着河边走走。有没有同样喜欢城市漫步和纪录片的同学？可以先在评论区交换片单。", new Date(Date.now() - 60 * 60 * 1000).toISOString(), new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    ]);
  }
}

function normalizeUser(user: RecordValue) {
  return {
    id: String(user.id),
    displayName: String(user.display_name ?? "同学"),
    email: String(user.email ?? ""),
    campusEmail: user.campus_email ? String(user.campus_email) : null,
    campusVerified: validStudentCertification(user),
    verifiedUntil: user.verified_until ? String(user.verified_until) : null,
    university: user.university ? String(user.university) : null,
    verificationMethod: user.verification_method ? String(user.verification_method) : null,
    verificationStatus: String(user.verification_status ?? (asBool(user.campus_verified) ? "approved" : "unverified")),
    role: user.status === "active" && isAdminEmail(String(user.email ?? "")) ? "admin" : user.role === "demo" ? "demo" : "student",
    onboardingStep: Number(user.onboarding_step ?? 0),
    questionnaireCompleted: asBool(user.questionnaire_completed),
    matchingEnabled: asBool(user.matching_enabled),
    status: String(user.status ?? "active"),
  };
}

export async function getUser(userId: string) {
  const user = await getD1().prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<RecordValue>();
  return user ? normalizeUser(user) : null;
}

export async function getOnboardingSnapshot(userId: string) {
  const db = getD1();
  const [user, profile, answers] = await Promise.all([
    db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<RecordValue>(),
    db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first<RecordValue>(),
    db.prepare("SELECT question_id, answer FROM questionnaire_answers WHERE user_id = ?").bind(userId).all<RecordValue>(),
  ]);
  return {
    user: user ? normalizeUser(user) : null,
    profile: profile ? normalizeProfile(profile) : null,
    answers: Object.fromEntries(answers.results.map((item) => [String(item.question_id), Number(item.answer)])),
  };
}

function normalizeProfile(profile: RecordValue | null) {
  if (!profile) return null;
  return {
    gender: String(profile.gender ?? ""),
    grade: String(profile.grade ?? ""),
    major: String(profile.major ?? ""),
    campus: String(profile.campus ?? ""),
    hometown: String(profile.hometown ?? ""),
    height: profile.height ? Number(profile.height) : null,
    smoking: String(profile.smoking ?? ""),
    lookingFor: String(profile.looking_for ?? "relationship"),
    bio: String(profile.bio ?? ""),
    interests: parseJson<string[]>(profile.interests_json, []),
    photoUrl: profile.photo_url ? String(profile.photo_url) : null,
    personalityType: profile.personality_type ? String(profile.personality_type) : null,
    personalityScores: parseJson<Record<string, number>>(profile.personality_scores_json, {}),
    reviewStatus: String(profile.review_status ?? "pending"),
  };
}

export async function getProductSnapshot(userId: string) {
  await assertParticipationReady(userId);
  const db = getD1();
  const [user, profile] = await Promise.all([
    db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<RecordValue>(),
    db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first<RecordValue>(),
  ]);
  await ensureRealMatch(userId);
  const allowDemo = process.env.DEMO_SEED_ENABLED === "true" ? 1 : 0;
  const match = await db
    .prepare(`
      SELECT m.* FROM matches m
      JOIN users other ON other.id = CASE WHEN m.user_a_id = ? THEN m.user_b_id ELSE m.user_a_id END
      WHERE (m.user_a_id = ? OR m.user_b_id = ?) AND m.status != 'passed'
        AND (other.role != 'demo' OR ? = 1)
        AND other.status = 'active' AND other.campus_verified = 1
        AND (other.verified_until IS NULL OR other.verified_until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ORDER BY CASE m.status WHEN 'mutual' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END, m.updated_at DESC
      LIMIT 1
    `)
    .bind(userId, userId, userId, allowDemo)
    .first<RecordValue>();

  let candidate = null;
  let messages: RecordValue[] = [];
  let ownIntent: string | null = null;
  let otherIntent: string | null = null;
  if (match) {
    const otherId = String(match.user_a_id) === userId ? String(match.user_b_id) : String(match.user_a_id);
    const [other, otherProfile, intents, messageRows] = await Promise.all([
      db.prepare("SELECT * FROM users WHERE id = ?").bind(otherId).first<RecordValue>(),
      db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(otherId).first<RecordValue>(),
      db.prepare("SELECT user_id, intent FROM match_intents WHERE match_id = ?").bind(match.id).all<RecordValue>(),
      db.prepare("SELECT * FROM messages WHERE match_id = ? ORDER BY created_at ASC LIMIT 100").bind(match.id).all<RecordValue>(),
    ]);
    const normalized = normalizeProfile(otherProfile);
    candidate = other ? {
      id: otherId,
      name: String(other.display_name),
      university: String(other.university ?? "高校"),
      ...normalized,
      score: Number(match.score),
      reasons: parseJson<string[]>(match.shared_points_json, []),
    } : null;
    for (const item of intents.results) {
      if (String(item.user_id) === userId) ownIntent = String(item.intent);
      else otherIntent = String(item.intent);
    }
    messages = messageRows.results;
  }

  return {
    user: user ? normalizeUser(user) : null,
    profile: normalizeProfile(profile),
    match: match ? {
      id: Number(match.id),
      status: String(match.status),
      ownIntent,
      otherIntent,
      mutual: ownIntent === "interested" && otherIntent === "interested",
    } : null,
    candidate,
    messages: messages.map((item) => ({
      id: Number(item.id),
      senderId: String(item.sender_id),
      body: String(item.body),
      status: String(item.status),
      createdAt: String(item.created_at),
    })),
  };
}

type CandidateRow = RecordValue & { id: string };

function dimensionAverages(rows: RecordValue[]) {
  const totals = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const dimension = String(row.dimension);
    const current = totals.get(dimension) ?? { total: 0, count: 0 };
    totals.set(dimension, { total: current.total + Number(row.answer), count: current.count + 1 });
  }
  return new Map([...totals].map(([key, value]) => [key, value.total / value.count]));
}

async function calculateCompatibility(userId: string, userProfile: RecordValue, candidate: CandidateRow) {
  const db = getD1();
  const currentQuestionIds = new Set(allQuestions.map((question) => question.id));
  const [mine, theirs] = await Promise.all([
    db.prepare("SELECT question_id, dimension, answer FROM questionnaire_answers WHERE user_id = ?").bind(userId).all<RecordValue>(),
    db.prepare("SELECT question_id, dimension, answer FROM questionnaire_answers WHERE user_id = ?").bind(candidate.id).all<RecordValue>(),
  ]);
  const mineDimensions = dimensionAverages(mine.results.filter((row) => currentQuestionIds.has(String(row.question_id))));
  const theirDimensions = dimensionAverages(theirs.results.filter((row) => currentQuestionIds.has(String(row.question_id))));
  const dimensionNames: Record<string, string> = {
    life: "生活节奏", communication: "沟通方式", relationship: "关系期待",
    values: "核心价值观", personality: "相处气质", boundaries: "安全边界",
  };
  const similarities = [...mineDimensions].flatMap(([dimension, value]) => {
    const other = theirDimensions.get(dimension);
    return other === undefined ? [] : [{ dimension, similarity: 1 - Math.abs(value - other) / 4 }];
  });
  const questionnaireSimilarity = similarities.length
    ? similarities.reduce((sum, item) => sum + item.similarity, 0) / similarities.length
    : 0.55;

  const mineType = String(userProfile.personality_type ?? "");
  const theirType = String(candidate.personality_type ?? "");
  const sharedLetters = /^[EI][SN][TF][JP]$/.test(mineType) && /^[EI][SN][TF][JP]$/.test(theirType)
    ? [...mineType].filter((letter, index) => letter === theirType[index]).length
    : 2;
  const mineInterests = new Set(parseJson<string[]>(userProfile.interests_json, []).map((item) => item.toLowerCase()));
  const theirInterests = parseJson<string[]>(candidate.interests_json, []);
  const sharedInterests = theirInterests.filter((item) => mineInterests.has(item.toLowerCase()));
  const unionSize = new Set([...mineInterests, ...theirInterests.map((item) => item.toLowerCase())]).size || 1;
  const interestSimilarity = sharedInterests.length / unionSize;
  const expectationSimilarity = String(userProfile.looking_for ?? "relationship") === String(candidate.looking_for ?? "relationship") ? 1 : 0.35;
  const sameUniversity = String(candidate.university ?? "") === String(candidate.viewer_university ?? "");
  const rawScore = questionnaireSimilarity * 55 + (sharedLetters / 4) * 20 + interestSimilarity * 15 + expectationSimilarity * 7 + (sameUniversity ? 3 : 1);
  const score = Math.max(55, Math.min(96, Math.round(rawScore)));

  const reasons: string[] = [];
  if (mineType && theirType) reasons.push(mineType === theirType
    ? `你们的 MBTI 倾向都是 ${mineType}，但仍建议从真实经历开始了解`
    : `MBTI 四个维度中有 ${sharedLetters} 个倾向接近，既有共鸣也保留差异`);
  const closest = similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 2).map((item) => dimensionNames[item.dimension]);
  if (closest.length) reasons.push(`${closest.join("与")}的问卷答案相对接近`);
  if (sharedInterests.length) reasons.push(`共同兴趣：${sharedInterests.slice(0, 3).join("、")}`);
  else reasons.push("暂时没有相同兴趣标签，可以从各自的校园生活聊起");
  return { score, reasons: reasons.slice(0, 3) };
}

async function ensureRealMatch(userId: string) {
  const db = getD1();
  const viewer = await db.prepare(`
    SELECT u.*, p.personality_type, p.interests_json, p.looking_for
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?
  `).bind(userId).first<RecordValue>();
  if (!viewer || String(viewer.role) === "demo" || String(viewer.status) !== "active"
    || !validStudentCertification(viewer) || !asBool(viewer.questionnaire_completed) || !asBool(viewer.matching_enabled)) return;

  const active = await db.prepare(`
    SELECT m.id FROM matches m
    JOIN users other ON other.id = CASE WHEN m.user_a_id = ? THEN m.user_b_id ELSE m.user_a_id END
    WHERE (m.user_a_id = ? OR m.user_b_id = ?) AND m.status IN ('suggested', 'waiting', 'mutual') AND other.role != 'demo'
      AND other.status = 'active' AND other.campus_verified = 1
      AND (other.verified_until IS NULL OR other.verified_until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    LIMIT 1
  `).bind(userId, userId, userId).first();
  if (active) return;

  const candidates = await db.prepare(`
    SELECT u.id, u.university, p.personality_type, p.interests_json, p.looking_for
    FROM users u JOIN profiles p ON p.user_id = u.id
    WHERE u.id != ? AND u.role != 'demo' AND u.status = 'active' AND u.campus_verified = 1 AND (u.verified_until IS NULL OR u.verified_until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND u.questionnaire_completed = 1 AND u.matching_enabled = 1
      AND TRIM(COALESCE(p.gender, '')) != '' AND TRIM(COALESCE(p.grade, '')) != '' AND TRIM(COALESCE(p.major, '')) != '' AND TRIM(COALESCE(p.bio, '')) != ''
      AND NOT EXISTS (
        SELECT 1 FROM matches existing
        JOIN users partner ON partner.id = CASE WHEN existing.user_a_id = u.id THEN existing.user_b_id ELSE existing.user_a_id END
        WHERE (existing.user_a_id = u.id OR existing.user_b_id = u.id)
          AND existing.status IN ('suggested', 'waiting', 'mutual')
          AND partner.role != 'demo'
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches pair
        WHERE (pair.user_a_id = ? AND pair.user_b_id = u.id) OR (pair.user_b_id = ? AND pair.user_a_id = u.id)
      )
    ORDER BY u.updated_at DESC LIMIT 30
  `).bind(userId, userId, userId).all<CandidateRow>();
  if (!candidates.results.length) return;

  const scored = await Promise.all(candidates.results.map(async (candidate) => ({
    candidate,
    compatibility: await calculateCompatibility(userId, viewer, { ...candidate, viewer_university: viewer.university }),
  })));
  scored.sort((a, b) => b.compatibility.score - a.compatibility.score);
  const best = scored[0];
  const [userA, userB] = [userId, best.candidate.id].sort();
  const timestamp = now();
  await db.prepare(`
    INSERT OR IGNORE INTO matches (user_a_id, user_b_id, score, status, shared_points_json, created_at, updated_at)
    VALUES (?, ?, ?, 'suggested', ?, ?, ?)
  `).bind(userA, userB, best.compatibility.score, JSON.stringify(best.compatibility.reasons), timestamp, timestamp).run();
}

export async function saveProfile(userId: string, input: RecordValue) {
  const db = getD1();
  const nickname = String(input.nickname ?? "").trim().slice(0, 20);
  if (nickname.length < 2) throw new Error("昵称至少需要 2 个字。 ");
  const gender = String(input.gender ?? "");
  if (gender !== "男生" && gender !== "女生") throw new Error("请选择男生或女生。");
  if (![input.grade, input.major, input.bio].every((value) => String(value ?? "").trim())) throw new Error("请完整填写年级、专业和自我介绍。");
  const interests = Array.isArray(input.interests)
    ? input.interests.map(String).filter(Boolean).slice(0, 8)
    : String(input.interests ?? "").split(/[，,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  await db.batch([
    db.prepare(`
      UPDATE profiles SET gender = ?, grade = ?, major = ?, campus = ?, hometown = ?, height = ?, smoking = ?,
        looking_for = ?, bio = ?, interests_json = ?, review_status = 'pending', updated_at = ? WHERE user_id = ?
    `).bind(
      gender, String(input.grade ?? ""), String(input.major ?? ""), String(input.campus ?? ""),
      String(input.hometown ?? ""), input.height ? Number(input.height) : null, String(input.smoking ?? ""),
      String(input.lookingFor ?? "relationship"), String(input.bio ?? "").slice(0, 300), JSON.stringify(interests), now(), userId,
    ),
    db.prepare("UPDATE users SET onboarding_step = MAX(onboarding_step, 2), updated_at = ? WHERE id = ?").bind(now(), userId),
    db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").bind(nickname, now(), userId),
  ]);
  return getOnboardingSnapshot(userId);
}

export async function updateProfilePhoto(userId: string, photoUrl: string) {
  if (!photoUrl.startsWith("https://") && !photoUrl.startsWith("/uploads/")) throw new Error("图片地址无效。 ");
  await getD1().prepare("UPDATE profiles SET photo_url = ?, review_status = 'pending', updated_at = ? WHERE user_id = ?")
    .bind(photoUrl.slice(0, 500), now(), userId).run();
  return { photoUrl };
}

export async function saveQuestionnaireSection(userId: string, answers: Record<string, number>, dimension: string) {
  const allowed = new Map(allQuestions.filter((item) => item.dimension === dimension).map((item) => [item.id, item]));
  const entries = Object.entries(answers).filter(([id, value]) => allowed.has(id) && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5);
  if (!entries.length) throw new Error("这一页还没有有效答案。");
  const db = getD1();
  const timestamp = now();
  await db.batch(entries.map(([questionId, answer]) => db.prepare(`
    INSERT INTO questionnaire_answers (user_id, question_id, dimension, answer, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, question_id) DO UPDATE SET answer = excluded.answer, dimension = excluded.dimension, updated_at = excluded.updated_at
  `).bind(userId, questionId, dimension, Number(answer), timestamp)));
  const sectionIndex = questionSections.findIndex((section) => section.id === dimension);
  await db.prepare("UPDATE users SET onboarding_step = MAX(onboarding_step, ?), updated_at = ? WHERE id = ?")
    .bind(sectionIndex + 3, timestamp, userId).run();
  return { saved: entries.length };
}

export async function completeQuestionnaire(userId: string) {
  const db = getD1();
  const ready = await db.prepare(`
    SELECT u.campus_verified, u.verified_until, p.major, p.gender, p.grade, p.bio
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?
  `).bind(userId).first<RecordValue>();
  if (!ready || !validStudentCertification(ready)) throw new Error("请先完成高校学生身份认证。");
  if (!ready.major || !ready.gender || !ready.grade || !ready.bio) throw new Error("请先完整填写个人资料。");
  const rows = await db.prepare("SELECT question_id, answer FROM questionnaire_answers WHERE user_id = ?").bind(userId).all<{ question_id: string; answer: number }>();
  const answered = new Set(rows.results.filter((row) => Number.isInteger(Number(row.answer)) && Number(row.answer) >= 1 && Number(row.answer) <= 5).map((row) => row.question_id));
  const count = allQuestions.filter((question) => answered.has(question.id)).length;
  if (count < allQuestions.length) throw new Error(`还有 ${allQuestions.length - count} 题未完成。`);
  await db.prepare("UPDATE users SET questionnaire_completed = 1, onboarding_step = 8, updated_at = ? WHERE id = ?")
    .bind(now(), userId).run();
  return { completed: true, count };
}

export async function createVerificationCode(userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] || "";
  if (!/^[^@\s]+@[^@\s]+$/.test(normalized) || !/(\.edu\.cn|\.edu|\.ac\.cn)$/.test(domain)) {
    throw new Error("请使用学校官方教育邮箱（如 .edu.cn / .edu）。");
  }
  const db = getD1();
  const recent = await db.prepare("SELECT created_at FROM verification_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(userId).first<{ created_at: string }>();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) throw new Error("验证码发送较频繁，请 60 秒后重试。");
  const duplicate = await db.prepare("SELECT id FROM users WHERE campus_email = ? AND id != ? LIMIT 1")
    .bind(normalized, userId).first();
  if (duplicate) throw new Error("该校园邮箱已绑定其他账号。");
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  const code = String(100000 + (values[0] % 900000));
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO verification_codes (user_id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, normalized, code, expiresAt, createdAt).run();
  const delivery = await deliverCampusCode(normalized, code);
  return { email: normalized, ...delivery, expiresAt };
}

export async function verifyCampusCode(userId: string, email: string, code: string, university: string) {
  const db = getD1();
  const record = await db.prepare(`
    SELECT * FROM verification_codes
    WHERE user_id = ? AND email = ? AND code = ? AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId, email.trim().toLowerCase(), code.trim()).first<RecordValue>();
  if (!record || new Date(String(record.expires_at)).getTime() < Date.now()) throw new Error("验证码无效或已过期。");
  const duplicate = await db.prepare("SELECT id FROM users WHERE campus_email = ? AND id != ? LIMIT 1")
    .bind(String(record.email), userId).first();
  if (duplicate) throw new Error("该校园邮箱已绑定其他账号。");
  const timestamp = now();
  await db.batch([
    db.prepare("UPDATE verification_codes SET consumed_at = ? WHERE id = ?").bind(timestamp, record.id),
    db.prepare("UPDATE users SET campus_email = ?, updated_at = ? WHERE id = ?")
      .bind(String(record.email), timestamp, userId),
  ]);
  return { emailVerified: true, verified: false, university, message: "邮箱已绑定；还需提交学籍或学生证材料，核验当前在读状态。" };
}

export async function savePersonalityResult(userId: string, type: string, scores: Record<string, number>, traits: Record<string, number> = {}) {
  const code = type.trim().toUpperCase();
  if (!/^[EI][SN][TF][JP]$/.test(code)) throw new Error("人格结果格式无效，请重新完成测试。");
  const normalizedScores = {
    ...Object.fromEntries(["energy", "information", "decision", "rhythm"].map((key) => [key, Number(scores[key] ?? 0)])),
    ...Object.fromEntries(["connection", "expression", "conflict", "exploration"].map((key) => [`relationship_${key}`, Number(traits[key] ?? 0)])),
  };
  await getD1().prepare("UPDATE profiles SET personality_type = ?, personality_scores_json = ?, updated_at = ? WHERE user_id = ?")
    .bind(code, JSON.stringify(normalizedScores), now(), userId).run();
  return { personalityType: code, personalityScores: normalizedScores };
}

export async function setMatching(userId: string, enabled: boolean) {
  await assertParticipationReady(userId);
  await getD1().prepare("UPDATE users SET matching_enabled = ?, updated_at = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, now(), userId).run();
  return { enabled };
}

export async function confirmMatchIntent(userId: string, matchId: number, intent: "interested" | "pass") {
  await assertParticipationReady(userId);
  const db = getD1();
  const user = await db.prepare("SELECT campus_verified, verified_until, questionnaire_completed, matching_enabled FROM users WHERE id = ?")
    .bind(userId).first<RecordValue>();
  if (!user || !validStudentCertification(user) || !asBool(user.questionnaire_completed)) throw new Error("完成高校认证和相处偏好后才能使用匹配。");
  if (!asBool(user.matching_enabled)) throw new Error("请先开启匹配推荐。");
  const match = await db.prepare("SELECT * FROM matches WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)")
    .bind(matchId, userId, userId).first<RecordValue>();
  if (!match) throw new Error("没有找到这条匹配。");
  const recipientId = String(match.user_a_id) === userId ? String(match.user_b_id) : String(match.user_a_id);
  const recipient = await db.prepare("SELECT status, campus_verified, verified_until FROM users WHERE id = ?").bind(recipientId).first<RecordValue>();
  if (!recipient || recipient.status !== "active" || !validStudentCertification(recipient)) throw new Error("对方当前的在读认证已失效，暂时无法继续这次匹配。");
  if (String(match.status) === "passed") throw new Error("这条匹配已经结束。");
  if (String(match.status) === "mutual" && intent === "pass") throw new Error("已解锁的私信不能通过匹配卡片略过，请使用举报或停止联系。");
  const timestamp = now();
  await db.prepare(`
    INSERT INTO match_intents (match_id, user_id, intent, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(match_id, user_id) DO UPDATE SET intent = excluded.intent, created_at = excluded.created_at
  `).bind(matchId, userId, intent, timestamp).run();
  const otherId = String(match.user_a_id) === userId ? String(match.user_b_id) : String(match.user_a_id);
  const otherIntent = await db.prepare("SELECT intent FROM match_intents WHERE match_id = ? AND user_id = ?")
    .bind(matchId, otherId).first<{ intent: string }>();
  const mutual = intent === "interested" && otherIntent?.intent === "interested";
  await db.prepare("UPDATE matches SET status = ?, updated_at = ? WHERE id = ?")
    .bind(mutual ? "mutual" : intent === "pass" ? "passed" : "waiting", timestamp, matchId).run();
  return { intent, mutual, snapshot: intent === "pass" ? await getProductSnapshot(userId) : null };
}

export async function addMessage(userId: string, matchId: number, body: string) {
  await assertParticipationReady(userId);
  const db = getD1();
  const text = body.trim().slice(0, 500);
  if (!text) throw new Error("消息不能为空。");
  const match = await db.prepare(`
    SELECT m.id FROM matches m
    JOIN users sender ON sender.id = ?
    JOIN users recipient ON recipient.id = CASE WHEN m.user_a_id = ? THEN m.user_b_id ELSE m.user_a_id END
    WHERE m.id = ? AND (m.user_a_id = ? OR m.user_b_id = ?)
      AND (SELECT COUNT(*) FROM match_intents mi WHERE mi.match_id = m.id AND mi.intent = 'interested') = 2
      AND sender.status = 'active' AND recipient.status = 'active'
      AND sender.campus_verified = 1 AND recipient.campus_verified = 1 AND (sender.verified_until IS NULL OR sender.verified_until > strftime('%Y-%m-%dT%H:%M:%fZ','now')) AND (recipient.verified_until IS NULL OR recipient.verified_until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `)
    .bind(userId, userId, matchId, userId, userId).first();
  if (!match) throw new Error("双方互相选择后才能发送私信。");
  const timestamp = now();
  const result = await db.prepare("INSERT INTO messages (match_id, sender_id, body, status, created_at) VALUES (?, ?, ?, 'sent', ?)")
    .bind(matchId, userId, text, timestamp).run();
  return { id: Number(result.meta.last_row_id), senderId: userId, body: text, status: "sent", createdAt: timestamp };
}

export async function getConversationUpdates(userId: string, matchId: number, afterId = 0) {
  await assertParticipationReady(userId);
  const db = getD1();
  const match = await db.prepare(`
    SELECT m.* FROM matches m JOIN users viewer ON viewer.id = ?
    WHERE m.id = ? AND (m.user_a_id = ? OR m.user_b_id = ?) AND viewer.status = 'active'
  `).bind(userId, matchId, userId, userId).first<RecordValue>();
  if (!match) throw new Error("没有找到这条会话。");
  const intents = await db.prepare("SELECT user_id, intent FROM match_intents WHERE match_id = ?")
    .bind(matchId).all<RecordValue>();
  let ownIntent: string | null = null;
  let otherIntent: string | null = null;
  for (const item of intents.results) {
    if (String(item.user_id) === userId) ownIntent = String(item.intent);
    else otherIntent = String(item.intent);
  }
  const mutual = ownIntent === "interested" && otherIntent === "interested";
  if (!mutual) return { matchId, status: String(match.status), ownIntent, otherIntent, mutual, messages: [] };

  await db.prepare("UPDATE messages SET status = 'read' WHERE match_id = ? AND sender_id != ? AND status != 'read'")
    .bind(matchId, userId).run();
  const rows = await db.prepare(`
    SELECT * FROM messages WHERE match_id = ? AND id > ? ORDER BY id ASC LIMIT 100
  `).bind(matchId, Math.max(0, Number(afterId) || 0)).all<RecordValue>();
  return {
    matchId,
    status: "mutual",
    ownIntent,
    otherIntent,
    mutual,
    messages: rows.results.map((item) => ({
      id: Number(item.id), senderId: String(item.sender_id), body: String(item.body),
      status: String(item.status), createdAt: String(item.created_at),
    })),
  };
}

async function assertPlazaReady(userId: string) {
  await assertParticipationReady(userId);
}

export async function getPlazaSnapshot(userId: string) {
  await assertPlazaReady(userId);
  const db = getD1();
  const allowDemo = process.env.DEMO_SEED_ENABLED === "true" ? 1 : 0;
  const [viewer, rows, commentRows] = await Promise.all([
    db.prepare(`SELECT u.university, p.personality_type FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`)
      .bind(userId).first<RecordValue>(),
    db.prepare(`
      SELECT pp.id, pp.author_id, pp.category, pp.audience, pp.content, pp.created_at,
        u.display_name, u.university, p.personality_type,
        (SELECT COUNT(*) FROM plaza_likes pl WHERE pl.post_id = pp.id) AS like_count,
        (SELECT COUNT(*) FROM plaza_comments pc JOIN users cu ON cu.id = pc.author_id WHERE pc.post_id = pp.id AND pc.status = 'visible' AND cu.status = 'active') AS comment_count,
        EXISTS(SELECT 1 FROM plaza_likes mine WHERE mine.post_id = pp.id AND mine.user_id = ?) AS viewer_liked
      FROM plaza_posts pp
      JOIN users u ON u.id = pp.author_id
      LEFT JOIN profiles p ON p.user_id = pp.author_id
      WHERE pp.status = 'visible'
        AND (u.role != 'demo' OR ? = 1)
        AND u.status = 'active'
        AND (pp.audience IN ('national', 'public') OR (pp.audience = 'same_university' AND u.university = (SELECT university FROM users WHERE id = ?)))
      ORDER BY pp.created_at DESC LIMIT 50
    `).bind(userId, allowDemo, userId).all<RecordValue>(),
    db.prepare(`
      SELECT pc.id, pc.post_id, pc.author_id, pc.body, pc.created_at, u.display_name, p.personality_type
      FROM plaza_comments pc
      JOIN users u ON u.id = pc.author_id
      LEFT JOIN profiles p ON p.user_id = pc.author_id
      JOIN plaza_posts pp ON pp.id = pc.post_id
      WHERE pc.status = 'visible' AND pp.status = 'visible' AND u.status = 'active'
      ORDER BY pc.created_at ASC LIMIT 200
    `).all<RecordValue>(),
  ]);
  const commentsByPost = new Map<number, RecordValue[]>();
  for (const item of commentRows.results) {
    const postId = Number(item.post_id);
    commentsByPost.set(postId, [...(commentsByPost.get(postId) ?? []), item]);
  }
  const official = await getOfficialPlazaPosts(userId);
  return {
    viewer: { university: String(viewer?.university ?? ""), personalityType: String(viewer?.personality_type ?? "") },
    posts: [official[0], ...rows.results.map((item) => ({
      id: Number(item.id),
      authorId: String(item.author_id),
      authorName: String(item.display_name),
      university: String(item.university ?? "高校"),
      personalityType: String(item.personality_type ?? "未测试"),
      category: String(item.category),
      audience: String(item.audience),
      content: String(item.content),
      likeCount: Number(item.like_count ?? 0),
      commentCount: Number(item.comment_count ?? 0),
      viewerLiked: asBool(item.viewer_liked),
      createdAt: String(item.created_at),
      comments: (commentsByPost.get(Number(item.id)) ?? []).slice(-3).map((comment) => ({
        id: Number(comment.id),
        authorId: String(comment.author_id),
        authorName: String(comment.display_name),
        personalityType: String(comment.personality_type ?? "未测试"),
        body: String(comment.body),
        createdAt: String(comment.created_at),
      })),
    })), ...official.slice(1)],
  };
}

export async function createPlazaPost(userId: string, category: string, audience: string, content: string) {
  await assertPlazaReady(userId);
  const allowedCategories = new Set(["校园瞬间", "寻找同伴", "情绪树洞", "观点交换"]);
  const safeCategory = allowedCategories.has(category) ? category : "校园瞬间";
  const safeAudience = audience === "public" ? "public" : audience === "same_university" ? "same_university" : "national";
  const text = content.trim().slice(0, 500);
  if (text.length < 5) throw new Error("至少写 5 个字，再发布这条动态。");
  const timestamp = now();
  const result = await getD1().prepare(`
    INSERT INTO plaza_posts (author_id, category, audience, content, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'visible', ?, ?)
  `).bind(userId, safeCategory, safeAudience, text, timestamp, timestamp).run();
  return { id: Number(result.meta.last_row_id) };
}

async function assertVisiblePlazaPost(userId: string, postId: number) {
  const topic = getOfficialTopic(postId);
  if (topic) return { id: topic.id, author_id: `official-${topic.companion === 0 ? "xiaotong" : "xiaopin"}` };
  const post = await getD1().prepare(`
    SELECT pp.id, pp.author_id FROM plaza_posts pp
    JOIN users author ON author.id = pp.author_id
    JOIN users viewer ON viewer.id = ?
    WHERE pp.id = ? AND pp.status = 'visible'
      AND author.status = 'active'
      AND (pp.audience IN ('national', 'public') OR (pp.audience = 'same_university' AND author.university = viewer.university))
  `).bind(userId, postId).first<RecordValue>();
  if (!post) throw new Error("这条动态不存在或你无权查看。");
  return post;
}

export async function togglePlazaLike(userId: string, postId: number) {
  await assertPlazaReady(userId);
  const db = getD1();
  await assertVisiblePlazaPost(userId, postId);
  const existing = await db.prepare("SELECT id FROM plaza_likes WHERE post_id = ? AND user_id = ?").bind(postId, userId).first<RecordValue>();
  if (existing) {
    await db.prepare("DELETE FROM plaza_likes WHERE id = ?").bind(existing.id).run();
  } else {
    await db.prepare("INSERT INTO plaza_likes (post_id, user_id, created_at) VALUES (?, ?, ?)").bind(postId, userId, now()).run();
  }
  const count = await db.prepare("SELECT COUNT(*) AS count FROM plaza_likes WHERE post_id = ?").bind(postId).first<{ count: number }>();
  return { postId, liked: !existing, likeCount: Number(count?.count ?? 0) };
}

export async function addPlazaComment(userId: string, postId: number, body: string) {
  await assertPlazaReady(userId);
  const text = body.trim().slice(0, 160);
  if (text.length < 2) throw new Error("评论至少需要 2 个字。");
  const db = getD1();
  await assertVisiblePlazaPost(userId, postId);
  const timestamp = now();
  const result = await db.prepare("INSERT INTO plaza_comments (post_id, author_id, body, status, created_at) VALUES (?, ?, ?, 'visible', ?)")
    .bind(postId, userId, text, timestamp).run();
  const user = await db.prepare(`SELECT u.display_name, p.personality_type FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`)
    .bind(userId).first<RecordValue>();
  return { id: Number(result.meta.last_row_id), authorId: userId, authorName: String(user?.display_name ?? "同学"), personalityType: String(user?.personality_type ?? "未测试"), body: text, createdAt: timestamp };
}

export async function deletePlazaPost(userId: string, postId: number) {
  await assertPlazaReady(userId);
  const result = await getD1().prepare(`
    UPDATE plaza_posts SET status = 'deleted', updated_at = ?
    WHERE id = ? AND author_id = ? AND status = 'visible'
  `).bind(now(), postId, userId).run();
  if (!result.meta.changes) throw new Error("动态不存在或无权删除。");
  return { postId, deleted: true };
}

export async function createReport(userId: string, targetUserId: string, category: string, detail: string) {
  const db = getD1();
  await assertPlazaReady(userId);
  if (!targetUserId || targetUserId === userId) throw new Error("不能举报自己。");
  const target = await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(targetUserId).first();
  if (!target) throw new Error("被举报用户不存在或已停用。");
  const timestamp = now();
  const result = await db.prepare(`
    INSERT INTO reports (reporter_id, target_user_id, category, detail, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).bind(userId, targetUserId, category.slice(0, 40), detail.slice(0, 500), timestamp).run();
  return { id: Number(result.meta.last_row_id), status: "pending" };
}

export async function getAdminSnapshot(userId: string) {
  const db = getD1();
  const actor = await getUser(userId);
  if (actor?.role !== "admin") throw new Error("仅管理员可以访问。");
  await purgeVerificationEvidence();
  const [counts, users, verificationRows, reportRows, logs] = await Promise.all([
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM users WHERE role != 'demo') AS users,
      (SELECT COUNT(*) FROM users WHERE questionnaire_completed = 1 AND role != 'demo') AS completed,
      (SELECT COUNT(*) FROM matches) AS matches,
      (SELECT COUNT(*) FROM messages) AS messages,
      (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports,
      (SELECT COUNT(*) FROM verification_requests WHERE status = 'pending') AS pending_verifications
    `).first<RecordValue>(),
    db.prepare(`SELECT u.id, u.display_name, u.campus_email, CASE WHEN u.verified_until IS NULL OR u.verified_until > strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN u.campus_verified ELSE 0 END AS campus_verified, u.verified_until, u.university, u.verification_method, u.verification_status, u.questionnaire_completed, u.matching_enabled, u.status,
      p.major, p.grade, p.review_status, u.created_at
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.role != 'demo' ORDER BY u.created_at DESC LIMIT 100`).all<RecordValue>(),
    db.prepare(`SELECT vr.id, vr.user_id, vr.method, vr.university, vr.identifier, vr.note, vr.status, vr.created_at, vr.evidence_version, vr.evidence_expires_at, vr.review_note, u.display_name
      FROM verification_requests vr JOIN users u ON u.id = vr.user_id
      ORDER BY CASE vr.status WHEN 'pending' THEN 0 ELSE 1 END, vr.created_at DESC LIMIT 100`).all<RecordValue>(),
    db.prepare(`SELECT r.*, reporter.display_name AS reporter_name, target.display_name AS target_name
      FROM reports r JOIN users reporter ON reporter.id = r.reporter_id JOIN users target ON target.id = r.target_user_id
      ORDER BY r.created_at DESC LIMIT 100`).all<RecordValue>(),
    db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30").all<RecordValue>(),
  ]);
  // Native SQLite rows have a null prototype; client props must be plain objects.
  return { counts: { ...counts }, users: users.results.map((row) => ({ ...row })), verifications: verificationRows.results.map((row) => ({ ...row })), reports: reportRows.results.map((row) => ({ ...row })), logs: logs.results.map((row) => ({ ...row })) };
}

export async function resolveReport(actorId: string, reportId: number, status: "resolved" | "dismissed", note: string) {
  const actor = await getUser(actorId);
  if (actor?.role !== "admin") throw new Error("仅管理员可以操作。");
  const db = getD1();
  const timestamp = now();
  await db.batch([
    db.prepare("UPDATE reports SET status = ?, admin_note = ?, resolved_at = ? WHERE id = ?")
      .bind(status, note.slice(0, 300), timestamp, reportId),
    db.prepare("INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, detail, created_at) VALUES (?, 'resolve_report', 'report', ?, ?, ?)")
      .bind(actorId, String(reportId), JSON.stringify({ status, note: note.slice(0, 100) }), timestamp),
  ]);
  return { id: reportId, status };
}

export async function reviewProfile(actorId: string, targetUserId: string, reviewStatus: "approved" | "rejected") {
  const actor = await getUser(actorId);
  if (actor?.role !== "admin") throw new Error("仅管理员可以操作。");
  const db = getD1();
  const timestamp = now();
  await db.batch([
    db.prepare("UPDATE profiles SET review_status = ?, updated_at = ? WHERE user_id = ?").bind(reviewStatus, timestamp, targetUserId),
    db.prepare("INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, detail, created_at) VALUES (?, 'review_profile', 'user', ?, ?, ?)")
      .bind(actorId, targetUserId, reviewStatus, timestamp),
  ]);
  return { userId: targetUserId, reviewStatus };
}
