import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const contentStatus = pgEnum("content_status", ["draft", "published", "archived"]);

/**
 * One table for every managed content type (project, venture, experience, ...).
 * - `data`  is the LIVE copy, shown publicly only when status = 'published'.
 * - `draft` holds unpublished edits (draft overlay). Publishing copies draft -> data.
 * - `deleted_at` is a soft delete (trash); nothing is removed until "delete forever".
 * Every write is validated by the Zod schema registered for `type` (lib/content/schemas.ts).
 */
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    slug: text("slug"),
    title: text("title").notNull(), // denormalised for lists and search
    status: contentStatus("status").notNull().default("draft"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    draft: jsonb("draft").$type<Record<string, unknown> | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("content_public_idx").on(t.type, t.status, t.deletedAt, t.sortOrder),
    uniqueIndex("content_slug_unique")
      .on(t.type, t.slug)
      .where(sql`${t.slug} is not null and ${t.deletedAt} is null`),
  ],
);

export type ContentItem = typeof contentItems.$inferSelect;
