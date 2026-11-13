import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runScheduledPublishing } from "@/lib/content/scheduler";

/**
 * Backup trigger for scheduled publishing (e.g. a daily Vercel Cron on the free plan).
 * Disabled (404) unless CRON_SECRET is set; requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return new Response("Not found", { status: 404 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runScheduledPublishing(true);
    return Response.json(result.ran ? { published: result.published, failed: result.failed.length } : { published: [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
