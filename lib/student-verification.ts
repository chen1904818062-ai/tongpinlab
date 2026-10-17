export type StudentVerificationMethod = "chsi_code" | "student_card";
export const verificationChecks = {
  chsi_code: [
    { id: "official", text: "已在学信网官网输入验证码，查到有效的《教育部学籍在线验证报告》" },
    { id: "identity", text: "报告姓名、学校、完整学号与申请一致" },
    { id: "enrolled", text: "学籍状态为当前在读，非毕业、结业、退学；预计毕业日期仍有效" },
  ],
  student_card: [
    { id: "identity", text: "学生证姓名、学校、完整学号与申请一致" },
    { id: "challenge", text: "同框照片中的核验口令、日期清晰，与本次申请一致，无明显拼接" },
    { id: "enrolled", text: "当期注册章或学校在读证明清晰，能确认当前学期在读" },
  ],
} as const;
export type VerificationSummary = { id: number; method: string; status: string; university: string; review_note: string | null; created_at: string; evidence_expires_at: string | null };
export function validStudentCertification(row: { campus_verified?: unknown; verified_until?: unknown }) {
  // Preserve legacy approvals until the operator reviews individual accounts.
  return Number(row.campus_verified) === 1 && (row.verified_until == null || (typeof row.verified_until === "string" && new Date(row.verified_until).getTime() > Date.now()));
}
