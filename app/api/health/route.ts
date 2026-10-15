import { getD1 } from "@/db";
import { getEmailDeliveryStatus } from "@/lib/campus-email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getD1().prepare("SELECT 1 AS ok").first();
    const emailDelivery = getEmailDeliveryStatus();
    const authSecretReady = process.env.NODE_ENV !== "production" || Boolean(process.env.AUTH_CODE_SECRET);
    const registrationReady = emailDelivery !== "unavailable" && authSecretReady;
    return Response.json({
      ok: registrationReady,
      database: process.env.DATABASE_PROVIDER || "sqlite",
      registration: registrationReady ? "ready" : "unavailable",
      emailDelivery,
      authSecret: authSecretReady ? "ready" : "missing",
      time: new Date().toISOString(),
    }, { status: registrationReady ? 200 : 503 });
  } catch {
    return Response.json({ ok: false, database: "unavailable", registration: "unavailable" }, { status: 503 });
  }
}
