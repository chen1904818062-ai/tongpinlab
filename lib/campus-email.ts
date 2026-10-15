import "server-only";

type DeliveryResult = { delivery: "email" } | { delivery: "demo"; demoCode: string };
export type EmailDeliveryStatus = "email" | "demo" | "unavailable";

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "email";
  if (process.env.NODE_ENV !== "production" || process.env.AUTH_ALLOW_DEMO_CODES === "true") return "demo";
  return "unavailable";
}

async function deliverCode(email: string, code: string, title: string, description: string): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (getEmailDeliveryStatus() === "unavailable") {
      throw new Error("邮件服务尚未配置，请联系管理员。 ");
    }
    return { delivery: "demo", demoCode: code };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: title,
      html: `<div style="font-family:Arial,sans-serif;color:#17213b;line-height:1.7"><h2>同频实验室</h2><p>${description}</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#4b37e8">${code}</p><p>验证码 10 分钟内有效。若非本人操作，请忽略本邮件。</p></div>`,
    }),
  });
  if (!response.ok) throw new Error("验证码邮件暂时发送失败，请稍后再试。 ");
  return { delivery: "email" };
}

export function deliverCampusCode(email: string, code: string) {
  return deliverCode(email, code, "同频实验室高校认证验证码", "你的高校身份认证验证码是：");
}

export function deliverLoginCode(email: string, code: string) {
  return deliverCode(email, code, "同频实验室登录验证码", "你的登录验证码是：");
}
