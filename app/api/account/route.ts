import { cookies } from "next/headers";
import { deleteOwnAccount, sendAccountDeletionCode } from "@/db/account";
import { SESSION_COOKIE, shouldUseSecureCookie } from "@/lib/auth";
import { COMMUNITY_COOKIE } from "@/lib/community-access";
import { requireApiUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "send_delete_code") return ok(await sendAccountDeletionCode(user.id), { headers: { "cache-control": "private, no-store" } });
    if (body.action !== "delete_account") throw new Error("不支持的账号操作。");
    const result = await deleteOwnAccount(user.id, String(body.code || ""), String(body.confirmation || ""));
    const jar = await cookies();
    for (const name of [SESSION_COOKIE, COMMUNITY_COOKIE]) jar.set(name, "", { httpOnly: true, sameSite: "lax", secure: shouldUseSecureCookie(), path: "/", maxAge: 0 });
    return ok(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
