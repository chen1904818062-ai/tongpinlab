import { getD1 } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return new Response(null, { status: 404 });
  }
  try {
    const image = await getD1().prepare("SELECT bytes FROM avatar_images WHERE id = ?")
      .bind(id).first<{ bytes: ArrayBuffer | Uint8Array }>();
    if (!image) return new Response(null, { status: 404 });
    const bytes = new Uint8Array(image.bytes instanceof ArrayBuffer ? image.bytes : image.bytes.slice().buffer);
    return new Response(bytes, { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
