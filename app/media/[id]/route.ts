import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getMediaFile } from "@/lib/media";

/**
 * Serves an uploaded file by its unguessable id. Hardened because the bytes are user-supplied:
 * the stored (sniffed) type is used, never the upload's claimed type; `nosniff` stops content sniffing; the
 * sandboxed CSP means that even if a file were opened directly it could not run script or load anything.
 */
export async function GET(_request: Request, ctx: RouteContext<"/media/[id]">) {
  await connection();
  const { id } = await ctx.params;
  let file;
  try {
    file = await getMediaFile(await getDb(), id);
  } catch {
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const safeName = file.filename.replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
