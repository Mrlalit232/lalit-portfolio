import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { checkLoginAllowed, clearFailures, purgeOldAttempts, recordAttempt } from "./ratelimit";
import { createSession, keyedHash, purgeExpiredSessions } from "./sessions";
import { isTwoFactorEnabled } from "./twofactor";
import { authenticate, normalizeEmail } from "./users";

export type LoginResult =
  | { ok: true; twoFactor?: false; token: string; expiresAt: Date }
  /** Password was correct but the account has 2FA: no session yet, finish with completeSecondFactor(). */
  | { ok: true; twoFactor: true; userId: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterSec: number };

/** Full login flow: rate limit, verify, record, session. Free of HTTP concerns, so it is unit-testable. */
export async function attemptLogin(
  db: Db,
  input: { email: string; password: string; ip: string; userAgent?: string; secret: string },
): Promise<LoginResult> {
  const ipKey = `ip:${keyedHash(input.secret, input.ip)}`;
  const accountKey = `acct:${keyedHash(input.secret, normalizeEmail(input.email))}`;

  const gate = await checkLoginAllowed(db, { ip: ipKey, account: accountKey });
  if (!gate.allowed) return { ok: false, reason: "locked", retryAfterSec: gate.retryAfterSec };

  const user = await authenticate(db, input.email, input.password);
  if (!user) {
    await Promise.all([recordAttempt(db, ipKey, false), recordAttempt(db, accountKey, false)]);
    await logActivity(db, { action: "auth.login_failed", summary: "Failed login attempt" });
    return { ok: false, reason: "invalid" };
  }

  await clearFailures(db, accountKey);
  if (isTwoFactorEnabled(user)) return { ok: true, twoFactor: true, userId: user.id };
  const session = await createSession(db, { userId: user.id, ipHash: ipKey, userAgent: input.userAgent });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await logActivity(db, { actorId: user.id, action: "auth.login", summary: "Signed in" });
  // Opportunistic housekeeping; failures here must never break login.
  void Promise.all([purgeExpiredSessions(db), purgeOldAttempts(db)]).catch(() => {});
  return { ok: true, token: session.token, expiresAt: session.expiresAt };
}
