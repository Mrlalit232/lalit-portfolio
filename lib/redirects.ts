import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { redirects, type RedirectRow } from "@/db/schema";
import { logActivity } from "@/lib/activity";

export const REDIRECT_STATUSES = [301, 302, 307, 308] as const;

/** Paths the redirect manager must never touch (they would lock the owner out or break the app). */
const RESERVED = [/^\/admin(\/|$)/, /^\/api(\/|$)/, /^\/_next(\/|$)/, /^\/media(\/|$)/, /^\/preview(\/|$)/];

export type RedirectInput = { fromPath: string; toPath: string; status?: number; enabled?: boolean };
export type RedirectResult = { ok: true; row: RedirectRow } | { ok: false; error: string };

/** Internal paths only ("/x/y"); never a protocol, host or protocol-relative "//". */
export function normalizeInternalPath(raw: string): string | null {
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\s<>"'`]/.test(v) || v.length > 300) return null;
  if (v.includes("://")) return null;
  const path = v.length > 1 ? v.replace(/\/+$/, "") : v; // no trailing slash (matches canonical URLs)
  return path || "/";
}

/** Redirect target may also be an absolute https URL (e.g. a moved external page). */
export function normalizeTarget(raw: string): string | null {
  const v = raw.trim();
  if (/^https:\/\/[^\s<>"'`]+$/i.test(v) && v.length <= 500) return v;
  return normalizeInternalPath(v);
}

async function wouldLoop(db: Db, from: string, to: string, ignoreId?: string) {
  if (!to.startsWith("/")) return false;
  const rows = await db.select().from(redirects).where(eq(redirects.enabled, true));
  const map = new Map(rows.filter((r) => r.id !== ignoreId).map((r) => [r.fromPath, r.toPath]));
  map.set(from, to);
  let cur = to;
  for (let hops = 0; hops < 20; hops++) {
    if (cur === from) return true;
    const next = map.get(cur);
    if (!next) return false;
    cur = next;
  }
  return true; // chain too long
}

export async function listRedirects(db: Db) {
  return db.select().from(redirects).orderBy(asc(redirects.fromPath));
}

async function validate(db: Db, input: RedirectInput, ignoreId?: string): Promise<{ ok: true; from: string; to: string; status: number } | { ok: false; error: string }> {
  const from = normalizeInternalPath(input.fromPath);
  if (!from || from === "/") return { ok: false, error: "“From” must be an internal path such as /old-page (not the home page)." };
  if (RESERVED.some((re) => re.test(from))) return { ok: false, error: "That path is reserved and cannot be redirected." };
  const to = normalizeTarget(input.toPath);
  if (!to) return { ok: false, error: "“To” must be an internal path (/new-page) or a full https:// URL." };
  if (to === from) return { ok: false, error: "A redirect cannot point to itself." };
  const status = input.status ?? 301;
  if (!(REDIRECT_STATUSES as readonly number[]).includes(status)) return { ok: false, error: "Status must be 301, 302, 307 or 308." };
  if (await wouldLoop(db, from, to, ignoreId)) return { ok: false, error: "That redirect would create a loop." };
  return { ok: true, from, to, status };
}

export async function createRedirect(db: Db, actorId: string | undefined, input: RedirectInput): Promise<RedirectResult> {
  const v = await validate(db, input);
  if (!v.ok) return v;
  const [existing] = await db.select({ id: redirects.id }).from(redirects).where(eq(redirects.fromPath, v.from)).limit(1);
  if (existing) return { ok: false, error: `A redirect from ${v.from} already exists.` };
  const [row] = await db.insert(redirects).values({ fromPath: v.from, toPath: v.to, status: v.status, enabled: input.enabled ?? true }).returning();
  await logActivity(db, { actorId, action: "redirect.create", entityType: "redirect", entityId: row.id, summary: `Added redirect ${v.from} → ${v.to} (${v.status})` });
  return { ok: true, row };
}

export async function updateRedirect(db: Db, actorId: string, id: string, input: RedirectInput): Promise<RedirectResult> {
  const v = await validate(db, input, id);
  if (!v.ok) return v;
  const [clash] = await db.select({ id: redirects.id }).from(redirects).where(eq(redirects.fromPath, v.from)).limit(1);
  if (clash && clash.id !== id) return { ok: false, error: `A redirect from ${v.from} already exists.` };
  const [row] = await db.update(redirects).set({ fromPath: v.from, toPath: v.to, status: v.status, enabled: input.enabled ?? true }).where(eq(redirects.id, id)).returning();
  if (!row) return { ok: false, error: "Redirect not found." };
  await logActivity(db, { actorId, action: "redirect.update", entityType: "redirect", entityId: id, summary: `Updated redirect ${v.from} → ${v.to} (${v.status})` });
  return { ok: true, row };
}

export async function deleteRedirect(db: Db, actorId: string, id: string) {
  const [row] = await db.delete(redirects).where(eq(redirects.id, id)).returning();
  if (row) await logActivity(db, { actorId, action: "redirect.delete", entityType: "redirect", entityId: id, summary: `Deleted redirect ${row.fromPath}` });
  return Boolean(row);
}

/** Enabled redirects as { from: { to, status } } for the proxy. */
export async function activeRedirectMap(db: Db) {
  const rows = await db.select().from(redirects).where(eq(redirects.enabled, true));
  return Object.fromEntries(rows.map((r) => [r.fromPath, { to: r.toPath, status: r.status }]));
}

/**
 * Called when a PUBLISHED item's public path changes. Keeps old links working. Skips when the new
 * path is already a redirect source (to avoid loops) and never overwrites an owner-made redirect.
 */
export async function ensureAutoRedirect(db: Db, actorId: string | undefined, from: string, to: string) {
  if (from === to) return;
  const v = await validate(db, { fromPath: from, toPath: to, status: 301 });
  if (!v.ok) return;
  // The new location must not itself redirect away.
  await db.delete(redirects).where(eq(redirects.fromPath, v.to));
  const [existing] = await db.select({ id: redirects.id }).from(redirects).where(eq(redirects.fromPath, v.from)).limit(1);
  if (existing) return;
  await db.insert(redirects).values({ fromPath: v.from, toPath: v.to, status: 301, auto: true });
  await logActivity(db, { actorId, action: "redirect.auto", entityType: "redirect", summary: `Added automatic redirect ${v.from} → ${v.to} because a published URL changed` });
}
