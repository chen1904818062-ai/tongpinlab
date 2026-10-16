import "server-only";

export function isAdminEmail(email: string) {
  const ownerEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(ownerEmail && email.trim().toLowerCase() === ownerEmail);
}
