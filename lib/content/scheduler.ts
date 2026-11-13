import "server-only";
import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { publishDue } from "./service";

let lastRun = 0;
const MIN_INTERVAL_MS = 30_000;

/**
 * Publishes scheduled items that are due and invalidates the affected public caches.
 * Call it from route handlers only (revalidateTag cannot run during rendering). Throttled per server instance,
 * so calling it on every page view is cheap: at most one database query every 30 seconds.
 */
export async function runScheduledPublishing(force = false) {
  const now = Date.now();
  if (!force && now - lastRun < MIN_INTERVAL_MS) return { ran: false as const };
  lastRun = now;
  const { changed, failed } = await publishDue(await getDb());
  for (const type of changed) revalidateTag(`content:${type}`, "max");
  if (changed.length) revalidateTag("settings", "max");
  return { ran: true as const, published: changed, failed };
}
