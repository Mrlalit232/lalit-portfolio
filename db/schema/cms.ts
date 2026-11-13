import { customType, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, boolean } from "drizzle-orm/pg-core";
import { contentItems } from "./content";
import { users } from "./auth";

/** Postgres bytea <-> Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value) => (typeof value === "string" ? Buffer.from(value.replace(/^\\x/, ""), "hex") : Buffer.from(value)),
});

/** Snapshot of an item's working copy, taken on every save/publish. Restoring one creates a new draft. */
export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    reason: text("reason").notNull(), // save | publish | unpublish | restore | schedule
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("revisions_item_version").on(t.itemId, t.version)],
);

/** Time-limited, revocable preview links. Only the SHA-256 of the token is stored. */
export const previewLinks = pgTable(
  "preview_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("preview_item_idx").on(t.itemId)],
);

/**
 * Uploaded files. Bytes live in Postgres (free tier, no extra service, same backup as the content).
 * Only an allow-list of types is accepted and the type is verified from the file's magic bytes.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    alt: text("alt").notNull().default(""),
    bytes: bytea("bytes").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

/** Messages from the public contact form (stored first, then emailed when delivery is configured). */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"), // new | read | archived | spam
    emailed: boolean("emailed").notNull().default(false),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [index("messages_status_idx").on(t.status, t.createdAt)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    status: integer("status").notNull().default(301), // 301 | 302 | 307 | 308
    enabled: boolean("enabled").notNull().default(true),
    auto: boolean("auto").notNull().default(false), // created automatically when a published slug changed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("redirects_enabled_idx").on(t.enabled)],
);

/** Small key/value store for CMS-managed settings (SEO defaults and overrides, resume file). */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/** Privacy-friendly analytics: daily page-view counts only. No cookies, no IPs, no user identifiers. */
export const pageViews = pgTable(
  "page_views",
  {
    day: date("day").notNull(),
    path: text("path").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [uniqueIndex("page_views_day_path").on(t.day, t.path)],
);

/** Two-factor authentication recovery codes (hashed, single use). */
export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recovery_user_idx").on(t.userId)],
);

export type MediaRow = typeof media.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type RedirectRow = typeof redirects.$inferSelect;
