import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { attemptLogin } from "@/lib/auth/login";
import { createAdminUser } from "@/lib/auth/users";
import { SECRET_UNREADABLE, totpAt } from "@/lib/auth/totp";
import { adminResetTwoFactor, beginSetup, completeSecondFactor, confirmSetup } from "@/lib/auth/twofactor";
import { validateSession } from "@/lib/auth/sessions";
import { GOOD_PASSWORD, SECRET, freshDb } from "./helpers";

/**
 * Verifies what docs/security.md ("Rotating AUTH_SECRET") promises. If one of these expectations changes, update
 * that section of the documentation too.
 */
const NEW_SECRET = "a-completely-different-secret-0123456789-abcdefghij";
const ip = "198.51.100.9";
let h: DbHandle;

beforeAll(async () => {
  h = await freshDb();
});
afterAll(async () => {
  await h.close();
});

describe("rotating AUTH_SECRET", () => {
  it("keeps existing sessions valid, because session tokens are random and stored as plain SHA-256 hashes", async () => {
    const owner = await createAdminUser(h.db, { email: "rot-plain@example.com", password: GOOD_PASSWORD });
    const login = await attemptLogin(h.db, { email: owner.email, password: GOOD_PASSWORD, ip, secret: SECRET });
    if (!login.ok || login.twoFactor) throw new Error("login");
    // validateSession has no secret parameter at all: nothing about a session depends on AUTH_SECRET.
    expect((await validateSession(h.db, login.token))?.user.id).toBe(owner.id);
    // Password sign-in simply continues to work under the new secret.
    expect((await attemptLogin(h.db, { email: owner.email, password: GOOD_PASSWORD, ip, secret: NEW_SECRET })).ok).toBe(true);
  });

  it("breaks two-factor sign-in with a clear server-side message, and the command-line reset recovers the account", async () => {
    const owner = await createAdminUser(h.db, { email: "rot-2fa@example.com", password: GOOD_PASSWORD });
    const setup = await beginSetup(h.db, owner.id, SECRET);
    if (!setup.ok) throw new Error("setup");
    const enrolled = await confirmSetup(h.db, owner.id, totpAt(setup.secret, Date.now()), SECRET);
    if (!enrolled.ok) throw new Error("confirm");

    // Works before the rotation...
    const before = await completeSecondFactor(h.db, { userId: owner.id, code: totpAt(setup.secret, Date.now() + 30_000), ip, secret: SECRET });
    expect(before.ok).toBe(true);

    // ...a TOTP code cannot be verified after it (the stored secret is encrypted with a key derived from the old value)...
    await expect(
      completeSecondFactor(h.db, { userId: owner.id, code: totpAt(setup.secret, Date.now() + 60_000), ip, secret: NEW_SECRET }),
    ).rejects.toThrow(SECRET_UNREADABLE);
    expect(SECRET_UNREADABLE).toContain("admin:reset-2fa");
    expect(SECRET_UNREADABLE).not.toContain(SECRET);

    // ...and the old recovery codes (keyed hashes) no longer match.
    const recovery = await completeSecondFactor(h.db, { userId: owner.id, code: enrolled.recoveryCodes[0], ip, secret: NEW_SECRET });
    expect(recovery.ok).toBe(false);

    // The documented recovery: reset 2FA from the command line, sign in with the password, enrol again under the new secret.
    expect(await adminResetTwoFactor(h.db, owner.email)).toBe(true);
    const again = await attemptLogin(h.db, { email: owner.email, password: GOOD_PASSWORD, ip, secret: NEW_SECRET });
    expect(again.ok && !again.twoFactor).toBe(true);
    const fresh = await beginSetup(h.db, owner.id, NEW_SECRET);
    if (!fresh.ok) throw new Error("re-setup");
    expect((await confirmSetup(h.db, owner.id, totpAt(fresh.secret, Date.now()), NEW_SECRET)).ok).toBe(true);
  });
});
