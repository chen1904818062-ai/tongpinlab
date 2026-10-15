import { fail, ok } from "@/lib/api";
import { sendEmailLoginCode } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    return ok(await sendEmailLoginCode(String(body.email || "")));
  } catch (error) {
    return fail(error);
  }
}
