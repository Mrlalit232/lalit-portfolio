import { connection } from "next/server";
import { getDb, hasHostedDb } from "@/lib/db";
import { resolvePreview } from "@/lib/content/preview";

/**
 * Used only by proxy.ts, so that an invalid or expired /preview/<token> returns a real HTTP 404 (a request-time
 * notFound() runs after the response has started and would stream a 200). POST body: { token }. Answers only
 * { valid: boolean }; it never returns content, and the token travels in the body, not the URL.
 */
export async function POST(request: Request) {
  await connection();
  const noStore = { "Cache-Control": "no-store" };
  const allowed = hasHostedDb() || process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DB === "1";
  if (!allowed) return Response.json({ valid: false }, { headers: noStore });
  try {
    const token = ((await request.json()) as { token?: unknown }).token;
    if (typeof token !== "string") return Response.json({ valid: false }, { headers: noStore });
    return Response.json({ valid: Boolean(await resolvePreview(await getDb(), token)) }, { headers: noStore });
  } catch {
    return Response.json({ valid: false }, { headers: noStore });
  }
}
