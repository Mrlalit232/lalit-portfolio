import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/db/client";
import { activityLog, loginAttempts, sessions, users } from "@/db/schema";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/auth/password";
import { can } from "@/lib/auth/permissions";
import { attemptLogin } from "@/lib/auth/login";
import { createSession, hashToken, revokeAllSessions, revokeSession, validateSession } from "@/lib/auth/sessions";
import { createAdminUser, setUserPassword } from "@/lib/auth/users";
import { SESSION_ABSOLUTE_MS } from "@/lib/auth/constants";
import { GOOD_PASSWORD, SECRET, freshDb } from "./helpers";

let h: DbHandle;
beforeAll(async () => {
  h = await freshDb();
});
afterAll(async () => {
  await h.close();
});

const login = (email: string, password: string, ip = "203.0.113.1") =>
  attemptLogin(h.db, { email, password, ip, secret: SECRET });

describe("passwords", () => {
  it("hashes with argon2id and verifies", async () => {
    const hash = await hashPassword(GOOD_PASSWORD);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, GOOD_PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, "wrong-password-123")).toBe(false);
    expect(await verifyPassword("not-a-hash", GOOD_PASSWORD)).toBe(false);
  });
  it("rejects weak passwords", () => {
    expect(checkPasswordStrength("short")).toMatch(/at least 12/);
    expect(checkPasswordStrength("aaaaaaaaaaaaaaaa")).toMatch(/repeated/);
    expect(checkPasswordStrength("lalitkumar-secret-1", "lalitkumar@example.com")).toMatch(/email name/);
    expect(checkPasswordStrength(GOOD_PASSWORD, "a@b.co")).toBeNull();
  });
});

describe("permissions", () => {
  it("owner has everything; editor cannot publish or manage users", () => {
    expect(can("owner", "users:manage")).toBe(true);
    expect(can("owner", "content:publish")).toBe(true);
    expect(can("editor", "content:write")).toBe(true);
    expect(can("editor", "content:publish")).toBe(false);
    expect(can("editor", "users:manage")).toBe(false);
  });
});

describe("account creation", () => {
  it("normalises email, rejects duplicates and weak passwords", async () => {
    const u = await createAdminUser(h.db, { email: "  Admin@Example.COM ", password: GOOD_PASSWORD });
    expect(u.email).toBe("admin@example.com");
    expect(u.passwordHash).not.toContain(GOOD_PASSWORD);
    await expect(createAdminUser(h.db, { email: "admin@example.com", password: GOOD_PASSWORD })).rejects.toThrow(/already exists/);
    await expect(createAdminUser(h.db, { email: "x@example.com", password: "short" })).rejects.toThrow(/at least 12/);
    await expect(createAdminUser(h.db, { email: "not-an-email", password: GOOD_PASSWORD })).rejects.toThrow(/Invalid email/);
  });
});

describe("login flow", () => {
  it("succeeds with valid credentials and stores only a hash of the token", async () => {
    const r = await login("admin@example.com", GOOD_PASSWORD, "198.51.100.10");
    expect(r.ok).toBe(true);
    if (!r.ok || r.twoFactor) return;
    const rows = await h.db.select().from(sessions);
    expect(rows.some((s) => s.id === r.token)).toBe(false); // raw token never stored
    expect(rows.some((s) => s.id === hashToken(r.token))).toBe(true);
    const v = await validateSession(h.db, r.token);
    expect(v?.user.email).toBe("admin@example.com");
  });

  it("gives the same generic result for wrong password and unknown account", async () => {
    const a = await login("admin@example.com", "wrong-password-xx", "198.51.100.11");
    const b = await login("nobody@example.com", "wrong-password-xx", "198.51.100.12");
    expect(a).toEqual({ ok: false, reason: "invalid" });
    expect(b).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks an account after 5 failures even for the correct password, then reports retry time", async () => {
    await createAdminUser(h.db, { email: "locked@example.com", password: GOOD_PASSWORD });
    for (let i = 0; i < 5; i++) {
      expect((await login("locked@example.com", "wrong-password-xx", `192.0.2.${i + 1}`)).ok).toBe(false);
    }
    const r = await login("locked@example.com", GOOD_PASSWORD, "192.0.2.99");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("locked");
      if (r.reason === "locked") expect(r.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("locks an IP after 20 failures across different accounts", async () => {
    for (let i = 0; i < 20; i++) await login(`ghost${i}@example.com`, "wrong-password-xx", "192.0.2.200");
    const r = await login("admin@example.com", GOOD_PASSWORD, "192.0.2.200");
    expect(r).toMatchObject({ ok: false, reason: "locked" });
  });

  it("a successful login clears that account's failure counter", async () => {
    await createAdminUser(h.db, { email: "clear@example.com", password: GOOD_PASSWORD });
    for (let i = 0; i < 3; i++) await login("clear@example.com", "wrong-password-xx", "192.0.2.50");
    expect((await login("clear@example.com", GOOD_PASSWORD, "192.0.2.51")).ok).toBe(true);
    for (let i = 0; i < 4; i++) await login("clear@example.com", "wrong-password-xx", "192.0.2.52");
    expect((await login("clear@example.com", GOOD_PASSWORD, "192.0.2.53")).ok).toBe(true); // 4 < 5 after reset
  });

  it("never stores raw IPs or emails in rate-limit keys, and never logs passwords", async () => {
    const attempts = await h.db.select().from(loginAttempts);
    for (const a of attempts) {
      expect(a.key).not.toContain("192.0.2");
      expect(a.key).not.toContain("@");
    }
    const logs = await h.db.select().from(activityLog);
    expect(JSON.stringify(logs)).not.toContain(GOOD_PASSWORD);
    expect(logs.some((l) => l.action === "auth.login")).toBe(true);
    expect(logs.some((l) => l.action === "auth.login_failed")).toBe(true);
  });
});

describe("sessions", () => {
  it("rejects unknown tokens", async () => {
    expect(await validateSession(h.db, "not-a-real-token")).toBeNull();
  });

  it("expires on idle timeout and on absolute lifetime", async () => {
    const [user] = await h.db.select().from(users).where(eq(users.email, "admin@example.com"));
    const idle = await createSession(h.db, { userId: user.id });
    await h.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, hashToken(idle.token)));
    expect(await validateSession(h.db, idle.token)).toBeNull();

    const old = await createSession(h.db, { userId: user.id });
    await h.db
      .update(sessions)
      .set({ createdAt: new Date(Date.now() - SESSION_ABSOLUTE_MS - 1000) })
      .where(eq(sessions.id, hashToken(old.token)));
    expect(await validateSession(h.db, old.token)).toBeNull();
    // expired sessions are deleted on detection
    expect((await h.db.select().from(sessions).where(eq(sessions.id, hashToken(old.token)))).length).toBe(0);
  });

  it("logout revokes the session; disabled users are rejected; password change revokes all sessions", async () => {
    const u = await createAdminUser(h.db, { email: "sess@example.com", password: GOOD_PASSWORD });
    const s1 = await createSession(h.db, { userId: u.id });
    const s2 = await createSession(h.db, { userId: u.id });
    await revokeSession(h.db, s1.token);
    expect(await validateSession(h.db, s1.token)).toBeNull();
    expect(await validateSession(h.db, s2.token)).not.toBeNull();

    await setUserPassword(h.db, u.id, "a-brand-new-long-password");
    expect(await validateSession(h.db, s2.token)).toBeNull();
    expect((await login("sess@example.com", GOOD_PASSWORD, "192.0.2.70")).ok).toBe(false);
    expect((await login("sess@example.com", "a-brand-new-long-password", "192.0.2.71")).ok).toBe(true);

    const s3 = await createSession(h.db, { userId: u.id });
    await h.db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, u.id));
    expect(await validateSession(h.db, s3.token)).toBeNull();
    await revokeAllSessions(h.db, u.id);
  });
});
