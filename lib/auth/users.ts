import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { checkPasswordStrength, hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { revokeAllSessions } from "./sessions";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** `role` defaults to owner (the only account type the CLI creates). Editors exist for tests and future multi-user use. */
export async function createAdminUser(db: Db, input: { email: string; password: string; name?: string; role?: "owner" | "editor" }) {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address.");
  const weak = checkPasswordStrength(input.password, email);
  if (weak) throw new Error(weak);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("An account with this email already exists.");
  const [user] = await db
    .insert(users)
    .values({ email, name: input.name, passwordHash: await hashPassword(input.password), role: input.role ?? "owner" })
    .returning();
  await logActivity(db, {
    actorId: user.id,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    summary: input.role === "editor" ? "Editor account created" : "Administrator account created",
  });
  return user;
}

/** Sets a new password and revokes every existing session for that user. */
export async function setUserPassword(db: Db, userId: string, newPassword: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found.");
  const weak = checkPasswordStrength(newPassword, user.email);
  if (weak) throw new Error(weak);
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
  await revokeAllSessions(db, userId);
  await logActivity(db, {
    actorId: userId,
    action: "user.password",
    entityType: "user",
    entityId: userId,
    summary: "Password changed; all sessions revoked",
  });
}

/** Constant-work credential check: unknown accounts still pay for an argon2 verification. */
export async function authenticate(db: Db, email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  if (!user || user.disabledAt) {
    await verifyAgainstDummy(password);
    return null;
  }
  return (await verifyPassword(user.passwordHash, password)) ? user : null;
}

export async function findUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return user ?? null;
}
