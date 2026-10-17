import { blob, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    platformUserId: text("platform_user_id").notNull(),
    email: text("email"),
    displayName: text("display_name").notNull(),
    campusEmail: text("campus_email"),
    campusVerified: integer("campus_verified").notNull().default(0),
    university: text("university"),
    verificationMethod: text("verification_method"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    verifiedUntil: text("verified_until"),
    role: text("role").notNull().default("student"),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    questionnaireCompleted: integer("questionnaire_completed").notNull().default(0),
    matchingEnabled: integer("matching_enabled").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("users_platform_user_id_uq").on(table.platformUserId),
    uniqueIndex("users_campus_email_uq").on(table.campusEmail),
    index("users_status_idx").on(table.status),
  ],
);

export const profiles = sqliteTable(
  "profiles",
  {
    userId: text("user_id").primaryKey(),
    gender: text("gender"),
    grade: text("grade"),
    major: text("major"),
    campus: text("campus"),
    hometown: text("hometown"),
    height: integer("height"),
    smoking: text("smoking"),
    lookingFor: text("looking_for").notNull().default("relationship"),
    bio: text("bio"),
    interestsJson: text("interests_json").notNull().default("[]"),
    photoUrl: text("photo_url"),
    personalityType: text("personality_type"),
    personalityScoresJson: text("personality_scores_json").notNull().default("{}"),
    reviewStatus: text("review_status").notNull().default("pending"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("profiles_review_status_idx").on(table.reviewStatus)],
);

export const verificationRequests = sqliteTable(
  "verification_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    method: text("method").notNull(),
    university: text("university").notNull(),
    identifier: text("identifier").notNull(),
    note: text("note"),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    reviewedAt: text("reviewed_at"),
    reviewerId: text("reviewer_id"),
    evidenceVersion: integer("evidence_version").notNull().default(0),
    encryptedEvidence: text("encrypted_evidence"),
    evidenceExpiresAt: text("evidence_expires_at"),
    identityKey: text("identity_key"),
    reportKey: text("report_key"),
    enrollmentUntil: text("enrollment_until"),
    reviewNote: text("review_note"),
    reviewedChecksJson: text("reviewed_checks_json"),
  },
  (table) => [
    index("verification_requests_status_created_idx").on(table.status, table.createdAt),
    index("verification_requests_user_idx").on(table.userId),
  ],
);

export const questionnaireAnswers = sqliteTable(
  "questionnaire_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    questionId: text("question_id").notNull(),
    dimension: text("dimension").notNull(),
    answer: integer("answer").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("questionnaire_user_question_uq").on(table.userId, table.questionId),
    index("questionnaire_user_dimension_idx").on(table.userId, table.dimension),
  ],
);

export const verificationCodes = sqliteTable(
  "verification_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("verification_user_created_idx").on(table.userId, table.createdAt)],
);

export const loginCodes = sqliteTable(
  "login_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    destination: text("destination").notNull(),
    channel: text("channel").notNull().default("email"),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("login_codes_destination_created_idx").on(table.destination, table.createdAt)],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    score: integer("score").notNull(),
    status: text("status").notNull().default("suggested"),
    sharedPointsJson: text("shared_points_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("matches_pair_uq").on(table.userAId, table.userBId),
    index("matches_user_a_status_idx").on(table.userAId, table.status),
    index("matches_user_b_status_idx").on(table.userBId, table.status),
  ],
);

export const matchIntents = sqliteTable(
  "match_intents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: integer("match_id").notNull(),
    userId: text("user_id").notNull(),
    intent: text("intent").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("match_intents_match_user_uq").on(table.matchId, table.userId),
    index("match_intents_match_idx").on(table.matchId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: integer("match_id").notNull(),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("sent"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("messages_match_created_idx").on(table.matchId, table.createdAt)],
);

export const plazaPosts = sqliteTable(
  "plaza_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: text("author_id").notNull(),
    category: text("category").notNull(),
    audience: text("audience").notNull().default("national"),
    content: text("content").notNull(),
    status: text("status").notNull().default("visible"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("plaza_posts_status_created_idx").on(table.status, table.createdAt),
    index("plaza_posts_author_idx").on(table.authorId),
  ],
);

export const plazaLikes = sqliteTable(
  "plaza_likes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("plaza_likes_post_user_uq").on(table.postId, table.userId),
    index("plaza_likes_post_idx").on(table.postId),
  ],
);

export const plazaComments = sqliteTable(
  "plaza_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("visible"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("plaza_comments_post_created_idx").on(table.postId, table.createdAt),
    index("plaza_comments_author_idx").on(table.authorId),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reporterId: text("reporter_id").notNull(),
    targetUserId: text("target_user_id").notNull(),
    category: text("category").notNull(),
    detail: text("detail"),
    status: text("status").notNull().default("pending"),
    adminNote: text("admin_note"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("reports_status_created_idx").on(table.status, table.createdAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export const avatarImages = sqliteTable("avatar_images", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  id: text("id").notNull().unique(),
  contentType: text("content_type").notNull(),
  bytes: blob("bytes", { mode: "buffer" }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const companionExperiences = sqliteTable("companion_experiences", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companionId: text("companion_id").notNull(),
  sceneId: text("scene_id").notNull(),
  choicesJson: text("choices_json").notNull().default("[]"),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.companionId] })]);
