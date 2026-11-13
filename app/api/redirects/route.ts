import { connection } from "next/server";
import { getDb, hasHostedDb } from "@/lib/db";
import { activeRedirectMap } from "@/lib/redirects";

/**
 * Enabled redirects as { "/old": { to, status } }. Read by proxy.ts (which cannot query the database itself).
 * Contains only public information. Returns {} when the database is unavailable, so the site keeps working.
 */
export async function GET() {
  await connection();
  const allowed = hasHostedDb() || process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DB === "1";
  if (!allowed) return Response.json({}, { headers: { "Cache-Control": "no-store" } });
  try {
    return Response.json(await activeRedirectMap(await getDb()), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({}, { headers: { "Cache-Control": "no-store" } });
  }
}
