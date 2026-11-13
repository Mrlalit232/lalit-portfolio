import { gte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { pageViews } from "@/db/schema";

/**
 * Privacy-friendly analytics: one counter per (day, path). No cookies, no IP addresses, no user agents,
 * no identifiers of any kind are stored, so there is nothing personal to protect or disclose.
 */
const PATH_RE = /^\/[A-Za-z0-9/_-]{0,150}$/;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|node-fetch|axios|playwright|puppeteer/i;

export function isCountablePath(path: unknown): path is string {
  return typeof path === "string" && PATH_RE.test(path) && !/^\/(admin|api|preview|media|_next)(\/|$)/.test(path);
}

export function isCountableRequest(headers: { userAgent?: string | null; dnt?: string | null; gpc?: string | null }) {
  if (headers.dnt === "1" || headers.gpc === "1") return false; // honour Do Not Track / Global Privacy Control
  if (!headers.userAgent || BOT_RE.test(headers.userAgent)) return false;
  return true;
}

export async function recordView(db: Db, path: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  await db
    .insert(pageViews)
    .values({ day, path: clean, views: 1 })
    .onConflictDoUpdate({ target: [pageViews.day, pageViews.path], set: { views: sql`${pageViews.views} + 1` } });
}

export type AnalyticsSummary = {
  total: number;
  last7: number;
  today: number;
  days: { day: string; views: number }[];
  top: { path: string; views: number }[];
};

export async function summarize(db: Db, days = 30, now = new Date()): Promise<AnalyticsSummary> {
  const since = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.select().from(pageViews).where(gte(pageViews.day, since));
  const perDay = new Map<string, number>();
  const perPath = new Map<string, number>();
  for (const r of rows) {
    perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.views);
    perPath.set(r.path, (perPath.get(r.path) ?? 0) + r.views);
  }
  const series: { day: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day: d, views: perDay.get(d) ?? 0 });
  }
  const todayKey = now.toISOString().slice(0, 10);
  return {
    total: series.reduce((n, d) => n + d.views, 0),
    last7: series.slice(-7).reduce((n, d) => n + d.views, 0),
    today: perDay.get(todayKey) ?? 0,
    days: series,
    top: [...perPath].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 10),
  };
}

/** Old counters are not needed forever. */
export async function purgeOlderThan(db: Db, days = 400) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  await db.delete(pageViews).where(sql`${pageViews.day} < ${cutoff}`);
}

