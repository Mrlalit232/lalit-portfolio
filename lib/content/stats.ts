import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { activityLog, contentItems, users } from "@/db/schema";
import { entities, type ContentType } from "./registry";

export type TypeCounts = { total: number; published: number; draft: number; archived: number; withUnpublishedChanges: number };

export async function dashboardStats(db: Db) {
  const grouped = await db
    .select({ type: contentItems.type, status: contentItems.status, n: count(), pending: sql<number>`count(*) filter (where ${contentItems.draft} is not null and ${contentItems.status} = 'published')` })
    .from(contentItems)
    .where(isNull(contentItems.deletedAt))
    .groupBy(contentItems.type, contentItems.status);

  const counts = {} as Record<ContentType, TypeCounts>;
  for (const type of Object.keys(entities) as ContentType[]) counts[type] = { total: 0, published: 0, draft: 0, archived: 0, withUnpublishedChanges: 0 };
  for (const row of grouped) {
    const c = counts[row.type as ContentType];
    if (!c) continue;
    const n = Number(row.n);
    c.total += n;
    c[row.status] += n;
    c.withUnpublishedChanges += Number(row.pending);
  }

  // Skills live inside skill groups, so count the entries in each group's working copy.
  const groups = await db
    .select({ data: contentItems.data, draft: contentItems.draft, status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.type, "skillGroup"), isNull(contentItems.deletedAt)));
  const len = (v: unknown) => (Array.isArray((v as { skills?: unknown[] } | null)?.skills) ? (v as { skills: unknown[] }).skills.length : 0);
  const skills = {
    total: groups.reduce((sum, g) => sum + len(g.draft ?? g.data), 0),
    published: groups.filter((g) => g.status === "published").reduce((sum, g) => sum + len(g.data), 0),
  };

  const [trash] = await db.select({ n: count() }).from(contentItems).where(sql`${contentItems.deletedAt} is not null`);

  const recentContent = await db
    .select({
      id: contentItems.id,
      type: contentItems.type,
      title: contentItems.title,
      status: contentItems.status,
      updatedAt: contentItems.updatedAt,
      hasDraft: sql<boolean>`${contentItems.draft} is not null`,
    })
    .from(contentItems)
    .where(isNull(contentItems.deletedAt))
    .orderBy(desc(contentItems.updatedAt))
    .limit(6);

  const recentActivity = await db
    .select({ id: activityLog.id, action: activityLog.action, summary: activityLog.summary, createdAt: activityLog.createdAt, actor: users.email })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .orderBy(desc(activityLog.createdAt))
    .limit(8);

  return { counts, skills, trash: Number(trash?.n ?? 0), recentContent, recentActivity };
}

export async function recentActivityFull(db: Db, limit = 100) {
  return db
    .select({ id: activityLog.id, action: activityLog.action, summary: activityLog.summary, createdAt: activityLog.createdAt, actor: users.email })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}

/** Cross-module search over titles and content, excluding Trash. */
export async function searchAll(db: Db, q: string) {
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({ id: contentItems.id, type: contentItems.type, title: contentItems.title, status: contentItems.status, updatedAt: contentItems.updatedAt })
    .from(contentItems)
    .where(and(isNull(contentItems.deletedAt), sql`(${contentItems.title} ilike ${like} or ${contentItems.data}::text ilike ${like} or ${contentItems.draft}::text ilike ${like})`))
    .orderBy(desc(contentItems.updatedAt))
    .limit(50);
}

export async function healthCheck(db: Db) {
  const t0 = performance.now();
  try {
    await db.execute(sql`select 1`);
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch (error) {
    return { ok: false, ms: 0, error: error instanceof Error ? error.message : "unknown error" };
  }
}
