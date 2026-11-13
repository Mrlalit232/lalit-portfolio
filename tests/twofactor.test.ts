import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/db/client";
import { recoveryCodes, users } from "@/db/schema";
import { attemptLogin } from "@/lib/auth/login";
import { createAdminUser, changeOwnPassword } from "@/lib/auth/users";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCode,
  hashRecoveryCode,
  signChallenge,
  totpAt,
  verifyChallenge,
  verifyTotp,
} from "@/lib/auth/totp";
import { beginSetup, completeSecondFactor, confirmSetup, disableTwoFactor, regenerateRecoveryCodes, adminResetTwoFactor, unusedRecoveryCodeCount, pendingSetup } from "@/lib/auth/twofactor";
import { validateSession } from "@/lib/auth/sessions";
import { GOOD_PASSWORD, SECRET, freshDb } from "./helpers";

let h: DbHandle;
let userId: string;
const EMAIL = "twofa@example.com";
const ip = "203.0.113.7";

beforeAll(async () => {
  h = await freshDb();
  userId = (await createAdminUser(h.db, { email: EMAIL, password: GOOD_PASSWORD })).id;
});
afterAll(async () => {
  await h.close();
});

describe("TOTP primitives", () => {
  it("matches the RFC 6238 SHA-1 test vectors (8-digit vectors truncated to 6)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    // RFC 6238 appendix B: T=59 -> 94287082, T=1111111109 -> 07081804, T=1234567890 -> 89005924
    expect(totpAt(secret, 59_000)).toBe("287082");
    expect(totpAt(secret, 1_111_111_109_000)).toBe("081804");
    expect(totpAt(secret, 1_234_567_890_000)).toBe("005924");
  });

  it("round-trips base32 and encrypts secrets (tamper and wrong key fail)", () => {
    const raw = Buffer.from([1, 2, 3, 250, 251]);
    expect(base32Decode(base32Encode(raw))).toEqual(raw);
    const enc = encryptSecret("JBSWY3DPEHPK3PXP", SECRET);
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc, SECRET)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(enc, "another-secret-another-secret-0123456789")).toThrow();
    const parts = enc.split(".");
    parts[3] = parts[3].slice(0, -2) + "AA";
    expect(() => decryptSecret(parts.join("."), SECRET)).toThrow();
  });

  it("accepts adjacent time steps, rejects others, and rejects replay of a used step", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const now = 1_700_000_000_000;
    const code = totpAt(secret, now);
    const step = verifyTotp(secret, code, now);
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).not.toBeNull(); // clock drift
    expect(verifyTotp(secret, totpAt(secret, now - 120_000), now)).toBeNull(); // too old
    expect(verifyTotp(secret, code, now, step)).toBeNull(); // replay
    expect(verifyTotp(secret, "12345", now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", now)).toBeNull();
  });

  it("signed challenges expire and cannot be forged", () => {
    const t = signChallenge(SECRET, userId, 1_000_000);
    expect(verifyChallenge(SECRET, t, 1_000_001)).toBe(userId);
    expect(verifyChallenge(SECRET, t, 1_000_000 + 6 * 60_000)).toBeNull();
    expect(verifyChallenge("different-secret-different-secret-012345", t, 1_000_001)).toBeNull();
    const [id, exp] = t.split(".");
    expect(verifyChallenge(SECRET, `${id}.${Number(exp) + 999999}.${t.split(".")[2]}`, 1_000_001)).toBeNull();
    expect(verifyChallenge(SECRET, "garbage", 1)).toBeNull();
    expect(verifyChallenge(SECRET, undefined, 1)).toBeNull();
  });

  it("recovery codes are 10 unambiguous characters and hashed deterministically", () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(hashRecoveryCode(SECRET, c)).toBe(hashRecoveryCode(SECRET, c.toLowerCase().replace("-", " ")));
  });
});

describe("two-factor enrolment and sign-in", () => {
  let secret = "";
  let codes: string[] = [];

  it("sign-in is unchanged until 2FA is confirmed", async () => {
    const setup = await beginSetup(h.db, userId, SECRET);
    if (!setup.ok) throw new Error("setup");
    secret = setup.secret;
    expect(setup.uri).toContain(`secret=${secret}`);
    expect((await pendingSetup(h.db, userId, SECRET))?.secret).toBe(secret); // reload-safe
    const r = await attemptLogin(h.db, { email: EMAIL, password: GOOD_PASSWORD, ip, secret: SECRET });
    expect(r.ok && !r.twoFactor).toBe(true); // pending setup does not lock the account
    const [u] = await h.db.select().from(users).where(eq(users.id, userId));
    expect(u.totpSecretEnc).not.toContain(secret); // stored encrypted
  });

  it("rejects a wrong confirmation code, accepts the right one and issues 10 one-time recovery codes", async () => {
    expect((await confirmSetup(h.db, userId, "000000", SECRET)).ok).toBe(false);
    const res = await confirmSetup(h.db, userId, totpAt(secret, Date.now()), SECRET);
    if (!res.ok) throw new Error(res.error);
    codes = res.recoveryCodes;
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(await unusedRecoveryCodeCount(h.db, userId)).toBe(10);
    const stored = await h.db.select().from(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    expect(stored.some((r) => codes.some((c) => r.codeHash.includes(c.replace("-", ""))))).toBe(false); // only hashes stored
  });

  it("the password alone no longer creates a session", async () => {
    const r = await attemptLogin(h.db, { email: EMAIL, password: GOOD_PASSWORD, ip, secret: SECRET });
    expect(r.ok && r.twoFactor).toBe(true);
    if (!r.ok || !r.twoFactor) return;
    expect(r.userId).toBe(userId);
    expect("token" in r).toBe(false);
  });

  it("a wrong code fails; a fresh code works once (no replay); the session is then valid", async () => {
    expect((await completeSecondFactor(h.db, { userId, code: "123456", ip, secret: SECRET })).ok).toBe(false);
    // The enrolment code used the current step; the next step is accepted as clock drift and is fresh.
    const next = totpAt(secret, Date.now() + 30_000);
    const ok = await completeSecondFactor(h.db, { userId, code: next, ip, secret: SECRET });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect((await validateSession(h.db, ok.token))?.user.id).toBe(userId);
    expect((await completeSecondFactor(h.db, { userId, code: next, ip, secret: SECRET })).ok).toBe(false); // replay
  });

  it("a recovery code works exactly once and is not case or format sensitive", async () => {
    const code = codes[0];
    const first = await completeSecondFactor(h.db, { userId, code: code.toLowerCase().replace("-", " "), ip, secret: SECRET });
    expect(first.ok && first.method === "recovery").toBe(true);
    expect((await completeSecondFactor(h.db, { userId, code, ip, secret: SECRET })).ok).toBe(false);
    expect(await unusedRecoveryCodeCount(h.db, userId)).toBe(9);
  });

  it("locks out after repeated wrong codes", async () => {
    let locked = false;
    for (let i = 0; i < 8; i++) {
      const r = await completeSecondFactor(h.db, { userId, code: "000000", ip: "198.51.100.99", secret: SECRET });
      if (!r.ok && r.reason === "locked") locked = true;
    }
    expect(locked).toBe(true);
    // Even a correct code is refused while locked.
    const good = await completeSecondFactor(h.db, { userId, code: totpAt(secret, Date.now() + 60_000), ip: "198.51.100.99", secret: SECRET });
    expect(good.ok).toBe(false);
  });

  it("changing settings needs password AND a valid second factor", async () => {
    // Fresh account state for clean rate-limit counters.
    const other = await createAdminUser(h.db, { email: "other2fa@example.com", password: GOOD_PASSWORD });
    const s = await beginSetup(h.db, other.id, SECRET);
    if (!s.ok) throw new Error("setup");
    const c = await confirmSetup(h.db, other.id, totpAt(s.secret, Date.now()), SECRET);
    if (!c.ok) throw new Error("confirm");
    const bad = await disableTwoFactor(h.db, other.id, "wrong-password-wrong", c.recoveryCodes[0], SECRET);
    expect(bad.ok).toBe(false);
    const noCode = await disableTwoFactor(h.db, other.id, GOOD_PASSWORD, "000000", SECRET);
    expect(noCode.ok).toBe(false);
    const regen = await regenerateRecoveryCodes(h.db, other.id, GOOD_PASSWORD, c.recoveryCodes[1], SECRET);
    expect(regen.ok && regen.recoveryCodes.length === 10).toBe(true);
    expect(await unusedRecoveryCodeCount(h.db, other.id)).toBe(10); // old codes invalidated
    const off = await disableTwoFactor(h.db, other.id, GOOD_PASSWORD, regen.ok ? regen.recoveryCodes[0] : "", SECRET);
    expect(off.ok).toBe(true);
    const r = await attemptLogin(h.db, { email: "other2fa@example.com", password: GOOD_PASSWORD, ip: "192.0.2.5", secret: SECRET });
    expect(r.ok && !r.twoFactor).toBe(true);
  });

  it("the command-line reset clears 2FA for a locked-out owner", async () => {
    expect(await adminResetTwoFactor(h.db, EMAIL)).toBe(true);
    expect(await adminResetTwoFactor(h.db, "nobody@example.com")).toBe(false);
    const r = await attemptLogin(h.db, { email: EMAIL, password: GOOD_PASSWORD, ip: "192.0.2.6", secret: SECRET });
    expect(r.ok && !r.twoFactor).toBe(true);
  });
});

describe("changing your own password", () => {
  it("needs the current password, enforces strength, and revokes other sessions only", async () => {
    const u = await createAdminUser(h.db, { email: "pw@example.com", password: GOOD_PASSWORD });
    const a = await attemptLogin(h.db, { email: "pw@example.com", password: GOOD_PASSWORD, ip: "192.0.2.9", secret: SECRET });
    const b = await attemptLogin(h.db, { email: "pw@example.com", password: GOOD_PASSWORD, ip: "192.0.2.10", secret: SECRET });
    if (!a.ok || a.twoFactor || !b.ok || b.twoFactor) throw new Error("login");
    const keep = (await validateSession(h.db, a.token))!.sessionId;

    expect((await changeOwnPassword(h.db, u.id, "wrong-current-password", "a-brand-new-passphrase-1", keep)).ok).toBe(false);
    expect((await changeOwnPassword(h.db, u.id, GOOD_PASSWORD, "short", keep)).ok).toBe(false);
    expect((await changeOwnPassword(h.db, u.id, GOOD_PASSWORD, GOOD_PASSWORD, keep)).ok).toBe(false);
    expect((await changeOwnPassword(h.db, u.id, GOOD_PASSWORD, "a-brand-new-passphrase-1", keep)).ok).toBe(true);

    expect(await validateSession(h.db, a.token)).not.toBeNull(); // current session survives
    expect(await validateSession(h.db, b.token)).toBeNull(); // others are signed out
    const old = await attemptLogin(h.db, { email: "pw@example.com", password: GOOD_PASSWORD, ip: "192.0.2.11", secret: SECRET });
    expect(old.ok).toBe(false);
    const fresh = await attemptLogin(h.db, { email: "pw@example.com", password: "a-brand-new-passphrase-1", ip: "192.0.2.12", secret: SECRET });
    expect(fresh.ok).toBe(true);
  });
});
