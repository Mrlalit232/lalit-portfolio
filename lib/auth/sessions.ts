import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, eq, lt, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, SESSION_TOUCH_INTERVAL_MS } from "./constants";

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
/** Keyed hash used for IP/account identifiers so raw values are never stored. */
export const keyedHash = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("hex");

export async function createSession(db: Db, input: { userId: string; ipHash?: string; userAgent?: string }) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_IDLE_MS);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId: input.userId,
    expiresAt,
    ipHash: input.ipHash,
    userAgent: input.userAgent?.slice(0, 300),
  });
  return { token, expiresAt };
}

/** Returns the user for a valid session token, extending the idle window at most every 15 minutes. */
export async function validateSession(db: Db, token: string) {
  const id = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;

  const now = Date.now();
  const absoluteEnd = row.session.createdAt.getTime() + SESSION_ABSOLUTE_MS;
  if (row.session.expiresAt.getTime() <= now || absoluteEnd <= now || row.user.disabledAt) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now - row.session.lastActiveAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastActiveAt: new Date(now), expiresAt: new Date(Math.min(now + SESSION_IDLE_MS, absoluteEnd)) })
      .where(eq(sessions.id, id));
  }
  return { user: row.user, sessionId: id };
}

export const revokeSession = (db: Db, token: string) => db.delete(sessions).where(eq(sessions.id, hashToken(token)));

/** Revokes all of a user's sessions, optionally keeping one (the current session). */
export const revokeAllSessions = (db: Db, userId: string, exceptSessionId?: string) =>
  db
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));

export const purgeExpiredSessions = (db: Db) => db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
