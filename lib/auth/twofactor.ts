import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { recoveryCodes, users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { checkLoginAllowed, clearFailures, recordAttempt } from "./ratelimit";
import { createSession, keyedHash } from "./sessions";
import {
  RECOVERY_CODE_COUNT,
  decryptSecret,
  encryptSecret,
  generateRecoveryCode,
  generateSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "./totp";
import { verifyPassword } from "./password";

const getUser = async (db: Db, userId: string) => (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0] ?? null;

export const isTwoFactorEnabled = (user: { totpEnabledAt: Date | null; totpSecretEnc: string | null }) => Boolean(user.totpEnabledAt && user.totpSecretEnc);

/** Starts enrolment: stores a NEW pending secret (encrypted). 2FA stays off until a code is confirmed. */
export async function beginSetup(db: Db, userId: string, authSecret: string) {
  const user = await getUser(db, userId);
  if (!user) throw new Error("User not found.");
  if (isTwoFactorEnabled(user)) return { ok: false as const, error: "Two-factor authentication is already enabled." };
  const secret = generateSecret();
  await db.update(users).set({ totpSecretEnc: encryptSecret(secret, authSecret), totpEnabledAt: null, totpLastStep: null }).where(eq(users.id, userId));
  return { ok: true as const, secret, uri: otpauthUri(secret, user.email) };
}

/** The pending (not yet confirmed) secret, so the setup page can be reloaded. */
export async function pendingSetup(db: Db, userId: string, authSecret: string) {
  const user = await getUser(db, userId);
  if (!user || isTwoFactorEnabled(user) || !user.totpSecretEnc) return null;
  const secret = decryptSecret(user.totpSecretEnc, authSecret);
  return { secret, uri: otpauthUri(secret, user.email) };
}

async function issueRecoveryCodes(db: Db, userId: string, authSecret: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  await db.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(authSecret, c) })));
  return codes; // shown to the user exactly once; only hashes are stored
}

/** Confirms enrolment with a code from the authenticator. Returns the recovery codes (shown once). */
export async function confirmSetup(db: Db, userId: string, code: string, authSecret: string) {
  const user = await getUser(db, userId);
  if (!user || !user.totpSecretEnc || isTwoFactorEnabled(user)) return { ok: false as const, error: "Start the setup first." };
  const step = verifyTotp(decryptSecret(user.totpSecretEnc, authSecret), code);
  if (step === null) return { ok: false as const, error: "That code is not correct. Check the time on your phone and try the next code." };
  await db.update(users).set({ totpEnabledAt: new Date(), totpLastStep: step }).where(eq(users.id, userId));
  const codes = await issueRecoveryCodes(db, userId, authSecret);
  await logActivity(db, { actorId: userId, action: "auth.2fa_enabled", entityType: "user", entityId: userId, summary: "Two-factor authentication enabled" });
  return { ok: true as const, recoveryCodes: codes };
}

/** Checks a TOTP code or an unused recovery code. Updates replay protection / consumes the recovery code. */
export async function checkSecondFactor(db: Db, userId: string, input: string, authSecret: string): Promise<"totp" | "recovery" | null> {
  const user = await getUser(db, userId);
  if (!user || user.disabledAt || !isTwoFactorEnabled(user)) return null;
  const trimmed = input.trim();
  if (/^\d{3}\s?\d{3}$/.test(trimmed)) {
    const step = verifyTotp(decryptSecret(user.totpSecretEnc!, authSecret), trimmed, Date.now(), user.totpLastStep);
    if (step === null) return null;
    // Compare-and-set: two concurrent requests cannot both consume the same step.
    const claimed = await db
      .update(users)
      .set({ totpLastStep: step })
      .where(and(eq(users.id, userId), user.totpLastStep === null ? isNull(users.totpLastStep) : eq(users.totpLastStep, user.totpLastStep)))
      .returning({ id: users.id });
    return claimed.length ? "totp" : null;
  }
  if (normalizeRecoveryCode(trimmed).length === 10) {
    const consumed = await db
      .update(recoveryCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, hashRecoveryCode(authSecret, trimmed)), isNull(recoveryCodes.usedAt)))
      .returning({ id: recoveryCodes.id });
    return consumed.length ? "recovery" : null;
  }
  return null;
}

export type SecondFactorResult =
  | { ok: true; token: string; expiresAt: Date; method: "totp" | "recovery" }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterSec: number };

/** Second step of sign-in. Rate limited per account and per IP, independently of password attempts. */
export async function completeSecondFactor(
  db: Db,
  input: { userId: string; code: string; ip: string; userAgent?: string; secret: string },
): Promise<SecondFactorResult> {
  const ipKey = `ip2fa:${keyedHash(input.secret, input.ip)}`;
  const accountKey = `2fa:${keyedHash(input.secret, input.userId)}`;
  const gate = await checkLoginAllowed(db, { ip: ipKey, account: accountKey });
  if (!gate.allowed) return { ok: false, reason: "locked", retryAfterSec: gate.retryAfterSec };

  const method = await checkSecondFactor(db, input.userId, input.code, input.secret);
  if (!method) {
    await Promise.all([recordAttempt(db, ipKey, false), recordAttempt(db, accountKey, false)]);
    await logActivity(db, { actorId: input.userId, action: "auth.2fa_failed", summary: "Failed two-factor verification" });
    return { ok: false, reason: "invalid" };
  }
  await clearFailures(db, accountKey);
  const session = await createSession(db, { userId: input.userId, ipHash: ipKey, userAgent: input.userAgent });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, input.userId));
  await logActivity(db, {
    actorId: input.userId,
    action: method === "recovery" ? "auth.2fa_recovery_used" : "auth.login",
    summary: method === "recovery" ? "Signed in with a recovery code" : "Signed in (two-factor)",
  });
  return { ok: true, token: session.token, expiresAt: session.expiresAt, method };
}

export async function unusedRecoveryCodeCount(db: Db, userId: string) {
  const rows = await db.select({ id: recoveryCodes.id }).from(recoveryCodes).where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
  return rows.length;
}

/** Requires the account password AND a valid second factor, so a hijacked session alone cannot weaken the account. */
async function reauthenticate(db: Db, userId: string, password: string, code: string, authSecret: string) {
  const user = await getUser(db, userId);
  if (!user || !isTwoFactorEnabled(user)) return { ok: false as const, error: "Two-factor authentication is not enabled." };
  // Same brute-force protection as sign-in, so a hijacked session cannot guess codes.
  const keys = { ip: `ip2fa:reauth:${keyedHash(authSecret, userId)}`, account: `2fa:${keyedHash(authSecret, userId)}` };
  const gate = await checkLoginAllowed(db, keys);
  if (!gate.allowed) return { ok: false as const, error: `Too many attempts. Try again in about ${Math.ceil(gate.retryAfterSec / 60)} minute(s).` };
  const fail = async (error: string) => {
    await Promise.all([recordAttempt(db, keys.ip, false), recordAttempt(db, keys.account, false)]);
    return { ok: false as const, error };
  };
  if (!(await verifyPassword(user.passwordHash, password))) return fail("Incorrect password.");
  if (!(await checkSecondFactor(db, userId, code, authSecret))) return fail("Incorrect authentication code.");
  return { ok: true as const };
}

export async function disableTwoFactor(db: Db, userId: string, password: string, code: string, authSecret: string) {
  const re = await reauthenticate(db, userId, password, code, authSecret);
  if (!re.ok) return re;
  await db.update(users).set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null }).where(eq(users.id, userId));
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  await logActivity(db, { actorId: userId, action: "auth.2fa_disabled", entityType: "user", entityId: userId, summary: "Two-factor authentication disabled" });
  return { ok: true as const };
}

export async function regenerateRecoveryCodes(db: Db, userId: string, password: string, code: string, authSecret: string) {
  const re = await reauthenticate(db, userId, password, code, authSecret);
  if (!re.ok) return re;
  const codes = await issueRecoveryCodes(db, userId, authSecret);
  await logActivity(db, { actorId: userId, action: "auth.2fa_codes", entityType: "user", entityId: userId, summary: "Recovery codes regenerated" });
  return { ok: true as const, recoveryCodes: codes };
}

/** Last-resort recovery for a lost device with no recovery codes: needs database access (CLI). */
export async function adminResetTwoFactor(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user) return false;
  await db.update(users).set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null }).where(eq(users.id, user.id));
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, user.id));
  await logActivity(db, { actorId: user.id, action: "auth.2fa_reset_cli", entityType: "user", entityId: user.id, summary: "Two-factor authentication reset from the command line" });
  return true;
}
