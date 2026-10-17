export type StudentVerificationMethod = "chsi_code" | "student_card";
export function verificationMethodLabel(method?: string | null) {
  return method === "campus_email" ? "校园邮箱认证" : method === "chsi_code" ? "学信网认证" : method === "student_card" ? "学生证认证" : "高校认证";
}
export type VerificationSummary = { id: number; method: string; status: string; university: string; review_note: string | null; created_at: string; evidence_expires_at: string | null };
export function validStudentCertification(row: { campus_verified?: unknown; verified_until?: unknown }) {
  // Preserve legacy approvals until the operator reviews individual accounts.
  return Number(row.campus_verified) === 1 && (row.verified_until == null || (typeof row.verified_until === "string" && new Date(row.verified_until).getTime() > Date.now()));
}
