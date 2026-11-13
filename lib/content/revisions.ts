import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contentRevisions } from "@/db/schema";
import type { EntityDef } from "./registry";
import { titleOf } from "./registry";

/** Keep the most recent N revisions per item. */
export const MAX_REVISIONS = 50;

export type RevisionReason = "save" | "publish" | "unpublish" | "restore" | "schedule";

/** Records a snapshot of an item's working copy. Never throws into the caller's main flow. */
export async function recordRevision(
  db: Db,
  def: EntityDef,
  itemId: string,
  data: Record<string, unknown>,
  reason: RevisionReason,
  actorId?: string,
) {
  try {
    const [row] = await db
      .select({ v: sql<number>`coalesce(max(${contentRevisions.version}), 0)` })
      .from(contentRevisions)
      .where(eq(contentRevisions.itemId, itemId));
    const version = Number(row?.v ?? 0) + 1;
    await db.insert(contentRevisions).values({ itemId, version, title: titleOf(def, data), data, reason, createdBy: actorId });
    if (version > MAX_REVISIONS) {
      await db.delete(contentRevisions).where(and(eq(contentRevisions.itemId, itemId), sql`${contentRevisions.version} <= ${version - MAX_REVISIONS}`));
    }
  } catch (error) {
    console.error("Could not record revision:", error instanceof Error ? error.message : error);
  }
}

export async function listRevisions(db: Db, itemId: string) {
  return db
    .select({
      id: contentRevisions.id,
      version: contentRevisions.version,
      title: contentRevisions.title,
      reason: contentRevisions.reason,
      createdAt: contentRevisions.createdAt,
      createdBy: contentRevisions.createdBy,
    })
    .from(contentRevisions)
    .where(eq(contentRevisions.itemId, itemId))
    .orderBy(desc(contentRevisions.version));
}

export async function getRevision(db: Db, itemId: string, revisionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(revisionId)) return null;
  const [row] = await db
    .select()
    .from(contentRevisions)
    .where(and(eq(contentRevisions.id, revisionId), eq(contentRevisions.itemId, itemId)))
    .limit(1);
  return row ?? null;
}

/** Number of revisions per item (for the list view). */
export async function revisionCount(db: Db, itemId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(contentRevisions).where(eq(contentRevisions.itemId, itemId));
  return Number(row?.n ?? 0);
}
