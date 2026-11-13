import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contentItems, previewLinks } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { hashToken, newToken } from "@/lib/auth/sessions";
import { entities, type ContentType } from "./registry";

/** Types that have a public page that can be rendered from a draft. */
export const PREVIEWABLE: ContentType[] = ["project", "venture"];
export const PREVIEW_DEFAULT_HOURS = 24;
export const PREVIEW_MAX_HOURS = 24 * 14;

export async function createPreviewLink(db: Db, itemId: string, actorId: string, hours = PREVIEW_DEFAULT_HOURS) {
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, itemId)).limit(1);
  if (!item || item.deletedAt) return { ok: false as const, error: "Item not found." };
  if (!PREVIEWABLE.includes(item.type as ContentType)) return { ok: false as const, error: "This content type has no preview page." };
  const h = Math.min(Math.max(Math.round(hours), 1), PREVIEW_MAX_HOURS);
  const token = newToken();
  const expiresAt = new Date(Date.now() + h * 3_600_000);
  await db.insert(previewLinks).values({ itemId, tokenHash: hashToken(token), expiresAt, createdBy: actorId });
  await logActivity(db, { actorId, action: `${item.type}.preview_link`, entityType: item.type, entityId: itemId, summary: `Created a ${h}-hour preview link for “${item.title}”` });
  return { ok: true as const, token, expiresAt };
}

/** The item behind a valid, unexpired, unrevoked token (or null). The token itself is never stored. */
export async function resolvePreview(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ link: previewLinks, item: contentItems })
    .from(previewLinks)
    .innerJoin(contentItems, eq(contentItems.id, previewLinks.itemId))
    .where(and(eq(previewLinks.tokenHash, hashToken(token)), isNull(previewLinks.revokedAt), gt(previewLinks.expiresAt, new Date()), isNull(contentItems.deletedAt)))
    .limit(1);
  if (!row) return null;
  const def = entities[row.item.type as ContentType];
  return def ? { item: row.item, def } : null;
}

export async function listPreviewLinks(db: Db, itemId: string) {
  return db
    .select({
      id: previewLinks.id,
      expiresAt: previewLinks.expiresAt,
      revokedAt: previewLinks.revokedAt,
      createdAt: previewLinks.createdAt,
      active: sql<boolean>`${previewLinks.revokedAt} is null and ${previewLinks.expiresAt} > now()`,
    })
    .from(previewLinks)
    .where(eq(previewLinks.itemId, itemId))
    .orderBy(desc(previewLinks.createdAt))
    .limit(10);
}

export async function revokePreviewLinks(db: Db, itemId: string, actorId: string) {
  const rows = await db
    .update(previewLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(previewLinks.itemId, itemId), isNull(previewLinks.revokedAt)))
    .returning({ id: previewLinks.id });
  if (rows.length) await logActivity(db, { actorId, action: "preview.revoke", entityType: "preview", entityId: itemId, summary: `Revoked ${rows.length} preview link(s)` });
  return rows.length;
}
