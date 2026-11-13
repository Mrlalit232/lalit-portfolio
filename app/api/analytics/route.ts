import { connection } from "next/server";
import { getDb, hasHostedDb } from "@/lib/db";
import { isCountablePath, isCountableRequest, recordView } from "@/lib/analytics";
import { runScheduledPublishing } from "@/lib/content/scheduler";

/**
 * Page-view beacon. Stores only a daily counter per path (see lib/analytics.ts): no cookies, IPs or identifiers.
 * Always answers 204 so it can never affect the visitor. Same-origin only, size-capped and rate limited per IP.
 * It also doubles as a cheap trigger for scheduled publishing (throttled), so scheduled posts go live without a cron.
 */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  await connection();
  const allowed = hasHostedDb() || process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DB === "1";
  if (!allowed) return noContent();

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host) return noContent(); // same-origin only
  } catch {
    return noContent();
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (limited(ip)) return noContent();

  try {
    const text = (await request.text()).slice(0, 512);
    const path = (JSON.parse(text) as { path?: unknown }).path;
    if (isCountablePath(path) && isCountableRequest({ userAgent: request.headers.get("user-agent"), dnt: request.headers.get("dnt"), gpc: request.headers.get("sec-gpc") })) {
      await recordView(await getDb(), path);
    }
    await runScheduledPublishing();
  } catch {
    // Analytics must never surface an error to visitors.
  }
  return noContent();
}
