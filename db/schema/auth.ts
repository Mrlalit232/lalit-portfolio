import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

/** Roles are stored from day one so permissions can be extended without schema changes. */
export const roleEnum = pgEnum("role", ["owner", "editor"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // always stored lowercase
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  /** AES-256-GCM encrypted TOTP secret (see lib/auth/totp.ts). Null = 2FA not set up. */
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  /** Last accepted TOTP time step, to reject replay of a code. */
  totpLastStep: integer("totp_last_step"),
});

/** `id` is the SHA-256 hash of the cookie token; the raw token is never stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Every login attempt, keyed by hashed IP or hashed account, for rate limiting. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    success: boolean("success").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

/** Append-only audit trail. Never store secrets in `meta`. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // e.g. auth.login, project.publish
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
