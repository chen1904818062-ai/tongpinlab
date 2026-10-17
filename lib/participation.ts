import "server-only";
import { getD1 } from "@/db";
import { allQuestions } from "@/lib/product-data";
import { AccessError } from "@/lib/access-error";
import { validStudentCertification } from "@/lib/student-verification";

export async function getParticipationStatus(userId: string) {
  const db = getD1();
  const [row, answers] = await Promise.all([
    db.prepare(`SELECT u.status, u.campus_verified, u.verified_until, u.questionnaire_completed, p.gender, p.grade, p.major, p.bio, p.personality_type
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`).bind(userId).first<Record<string, unknown>>(),
    db.prepare("SELECT question_id, answer FROM questionnaire_answers WHERE user_id = ?").bind(userId).all<Record<string, unknown>>(),
  ]);
  const saved = new Map(answers.results.map((answer) => [String(answer.question_id), Number(answer.answer)]));
  const count = allQuestions.filter((question) => Number.isInteger(saved.get(question.id)) && Number(saved.get(question.id)) >= 1 && Number(saved.get(question.id)) <= 5).length;
  const campusVerified = validStudentCertification(row || {});
  const profileReady = [row?.gender, row?.grade, row?.major, row?.bio].every((value) => typeof value === "string" && value.trim().length > 0);
  const questionnaireCompleted = Number(row?.questionnaire_completed) === 1 && count === allQuestions.length;
  return { ready: Boolean(row?.status === "active" && campusVerified && profileReady && questionnaireCompleted), campusVerified, profileReady, questionnaireCompleted, answeredCount: count, total: allQuestions.length, personalityType: String(row?.personality_type || "") };
}

export async function assertParticipationReady(userId: string) {
  if (!(await getParticipationStatus(userId)).ready) throw new AccessError("完成登录、高校认证、个人资料和匹配问卷后才能参与互动。", 403);
}
