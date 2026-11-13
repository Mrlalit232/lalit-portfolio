import { and, count, eq, gt, lt, min } from "drizzle-orm";
import type { Db } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import { LOGIN_MAX_FAILS_PER_ACCOUNT, LOGIN_MAX_FAILS_PER_IP, LOGIN_WINDOW_MS } from "./constants";

async function failures(db: Db, key: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [row] = await db
    .select({ n: count(), oldest: min(loginAttempts.createdAt) })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
  return { n: Number(row?.n ?? 0), oldest: row?.oldest ?? null };
}

/** Both limits must pass. Returns seconds to wait when blocked. */
export async function checkLoginAllowed(db: Db, keys: { ip: string; account: string }) {
  const [ip, account] = await Promise.all([failures(db, keys.ip), failures(db, keys.account)]);
  const blocked = [
    ip.n >= LOGIN_MAX_FAILS_PER_IP ? ip.oldest : null,
    account.n >= LOGIN_MAX_FAILS_PER_ACCOUNT ? account.oldest : null,
  ].filter(Boolean) as Date[];
  if (blocked.length === 0) return { allowed: true as const };
  const until = Math.max(...blocked.map((d) => d.getTime() + LOGIN_WINDOW_MS));
  return { allowed: false as const, retryAfterSec: Math.max(1, Math.ceil((until - Date.now()) / 1000)) };
}

export async function recordAttempt(db: Db, key: string, success: boolean) {
  await db.insert(loginAttempts).values({ key, success });
}

export async function clearFailures(db: Db, key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

export async function purgeOldAttempts(db: Db) {
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - LOGIN_WINDOW_MS * 4)));
}
