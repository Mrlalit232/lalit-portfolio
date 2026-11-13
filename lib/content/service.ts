import { and, asc, desc, eq, ilike, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contentItems, type ContentItem } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { ensureAutoRedirect } from "@/lib/redirects";
import { stripNul, stripNulDeep } from "@/lib/text";
import { issuesToFieldErrors } from "./codec";
import { entities, slugOf, titleOf, type ContentType, type EntityDef } from "./registry";
import { getRevision, recordRevision, type RevisionReason } from "./revisions";

export type StatusFilter = "all" | "draft" | "published" | "archived" | "trash";

export type Result =
  | { ok: true; item: ContentItem; message: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const fail = (error: string): Result => ({ ok: false, error });
const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The editable version of an item: pending draft if any, otherwise the live copy. */
export const workingCopy = (item: ContentItem) => (item.draft ?? item.data) as Record<string, unknown>;

function validate(def: EntityDef, input: Record<string, unknown>) {
  const data = stripNulDeep(input);
  const parsed = def.schema.safeParse(data);
  if (parsed.success) return { ok: true as const, data: JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown> };
  return { ok: false as const, fieldErrors: issuesToFieldErrors(def.fields, parsed.error.issues) };
}

/* ---------------- reads ---------------- */
export async function listItems(db: Db, def: EntityDef, opts: { status?: StatusFilter; q?: string } = {}) {
  const status = opts.status ?? "all";
  const where = [eq(contentItems.type, def.type)];
  where.push(status === "trash" ? isNotNull(contentItems.deletedAt) : isNull(contentItems.deletedAt));
  if (status === "draft" || status === "published" || status === "archived") where.push(eq(contentItems.status, status));
  if (opts.q && stripNul(opts.q).trim()) {
    const like = `%${escapeLike(stripNul(opts.q).trim())}%`;
    where.push(or(ilike(contentItems.title, like), sql`${contentItems.data}::text ilike ${like}`, sql`${contentItems.draft}::text ilike ${like}`)!);
  }
  return db.select().from(contentItems).where(and(...where)).orderBy(asc(contentItems.sortOrder), desc(contentItems.updatedAt));
}

export async function getItem(db: Db, def: EntityDef, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.type, def.type))).limit(1);
  return row ?? null;
}

export async function getSingleton(db: Db, def: EntityDef) {
  const [row] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.type, def.type), isNull(contentItems.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function slugTaken(db: Db, def: EntityDef, slug: string, exceptId?: string) {
  const where = [eq(contentItems.type, def.type), eq(contentItems.slug, slug), isNull(contentItems.deletedAt)];
  if (exceptId) where.push(ne(contentItems.id, exceptId));
  const [row] = await db.select({ id: contentItems.id }).from(contentItems).where(and(...where)).limit(1);
  return Boolean(row);
}

const slugError = (def: EntityDef, slug: string): Result => ({
  ok: false,
  fieldErrors: { [def.slugKey ?? "_form"]: `“${slug}” is already used by another ${def.singular.toLowerCase()}.` },
});

async function nextSortOrder(db: Db, def: EntityDef) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${contentItems.sortOrder}), 0)` })
    .from(contentItems)
    .where(eq(contentItems.type, def.type));
  return Number(row?.max ?? 0) + 1;
}

/* ---------------- writes ---------------- */
export async function createItem(db: Db, def: EntityDef, actorId: string, input: Record<string, unknown>): Promise<Result> {
  const v = validate(def, input);
  if (!v.ok) return { ok: false, fieldErrors: v.fieldErrors };
  const slug = slugOf(def, v.data);
  if (slug && (await slugTaken(db, def, slug))) return slugError(def, slug);
  const [item] = await db
    .insert(contentItems)
    .values({
      type: def.type,
      slug,
      title: titleOf(def, v.data),
      status: "draft",
      data: {},
      draft: v.data,
      sortOrder: await nextSortOrder(db, def),
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  await recordRevision(db, def, item.id, v.data, "save", actorId);
  await logActivity(db, { actorId, action: `${def.type}.create`, entityType: def.type, entityId: item.id, summary: `Created ${def.singular.toLowerCase()} “${item.title}” as a draft` });
  return { ok: true, item, message: `${def.singular} saved as a draft.` };
}

/** Saves edits into the draft overlay. A published item stays live and unchanged until publish. */
export async function saveDraft(db: Db, def: EntityDef, id: string, actorId: string, input: Record<string, unknown>, reason: RevisionReason = "save"): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  const v = validate(def, input);
  if (!v.ok) return { ok: false, fieldErrors: v.fieldErrors };
  const slug = slugOf(def, v.data);
  if (slug && (await slugTaken(db, def, slug, id))) return slugError(def, slug);
  const patch: Partial<typeof contentItems.$inferInsert> = { draft: v.data, updatedAt: new Date(), updatedBy: actorId };
  if (item.status !== "published") {
    // Not live: the visible title/slug follow the working copy.
    patch.title = titleOf(def, v.data);
    patch.slug = slug;
  }
  const [saved] = await db.update(contentItems).set(patch).where(eq(contentItems.id, id)).returning();
  await recordRevision(db, def, id, v.data, reason, actorId);
  await logActivity(db, { actorId, action: `${def.type}.save`, entityType: def.type, entityId: id, summary: `Saved draft of ${def.singular.toLowerCase()} “${titleOf(def, v.data)}”` });
  return { ok: true, item: saved, message: item.status === "published" ? "Draft saved. The live version is unchanged until you publish." : "Draft saved." };
}

/** Validates the working copy, then makes it the live version. */
export async function publish(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  if (item.status === "published" && !item.draft) return { ok: true, item, message: "Already published; there are no unpublished changes." };
  const v = validate(def, workingCopy(item));
  if (!v.ok) return { ok: false, fieldErrors: v.fieldErrors, error: "Fix the highlighted fields before publishing." };
  const slug = slugOf(def, v.data);
  if (slug && (await slugTaken(db, def, slug, id))) return slugError(def, slug);
  const [saved] = await db
    .update(contentItems)
    .set({
      data: v.data,
      draft: null,
      status: "published",
      slug,
      title: titleOf(def, v.data),
      publishedAt: item.publishedAt ?? new Date(),
      publishAt: null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(contentItems.id, id))
    .returning();
  await recordRevision(db, def, id, v.data, "publish", actorId);
  // A published URL changed: keep the old link working.
  if (def.type === "project" && item.status === "published" && item.slug && slug && item.slug !== slug) {
    await ensureAutoRedirect(db, actorId, `/projects/${item.slug}`, `/projects/${slug}`);
  }
  await logActivity(db, { actorId, action: `${def.type}.publish`, entityType: def.type, entityId: id, summary: `Published ${def.singular.toLowerCase()} “${saved.title}”` });
  return { ok: true, item: saved, message: `${def.singular} published.` };
}

export async function unpublish(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  if (item.status !== "published") return fail("Only published items can be unpublished.");
  const [saved] = await db
    .update(contentItems)
    .set({ status: "draft", draft: item.draft ?? item.data, updatedAt: new Date(), updatedBy: actorId })
    .where(eq(contentItems.id, id))
    .returning();
  await recordRevision(db, def, id, (item.draft ?? item.data) as Record<string, unknown>, "unpublish", actorId);
  await logActivity(db, { actorId, action: `${def.type}.unpublish`, entityType: def.type, entityId: id, summary: `Unpublished ${def.singular.toLowerCase()} “${saved.title}”` });
  return { ok: true, item: saved, message: `${def.singular} unpublished. It is now a draft and no longer public.` };
}

export async function discardDraft(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  if (item.status !== "published" || !item.draft) return fail("There are no unpublished changes to discard.");
  const [saved] = await db.update(contentItems).set({ draft: null, updatedAt: new Date(), updatedBy: actorId }).where(eq(contentItems.id, id)).returning();
  await logActivity(db, { actorId, action: `${def.type}.discard`, entityType: def.type, entityId: id, summary: `Discarded unpublished changes to “${saved.title}”` });
  return { ok: true, item: saved, message: "Unpublished changes discarded." };
}

export async function setArchived(db: Db, def: EntityDef, id: string, actorId: string, archived: boolean): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  const [saved] = await db
    .update(contentItems)
    .set({
      status: archived ? "archived" : "draft",
      draft: archived ? item.draft : (item.draft ?? item.data),
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(contentItems.id, id))
    .returning();
  await logActivity(db, { actorId, action: `${def.type}.${archived ? "archive" : "unarchive"}`, entityType: def.type, entityId: id, summary: `${archived ? "Archived" : "Restored from archive"} ${def.singular.toLowerCase()} “${saved.title}”` });
  return { ok: true, item: saved, message: archived ? `${def.singular} archived (not public).` : `${def.singular} restored as a draft.` };
}

/** Soft delete: moves to Trash and removes it from the public site. Recoverable. */
export async function softDelete(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  if (def.singleton) return fail("The profile cannot be deleted.");
  const [saved] = await db.update(contentItems).set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actorId }).where(eq(contentItems.id, id)).returning();
  await logActivity(db, { actorId, action: `${def.type}.delete`, entityType: def.type, entityId: id, summary: `Moved ${def.singular.toLowerCase()} “${saved.title}” to Trash` });
  return { ok: true, item: saved, message: `Moved to Trash. You can restore it from the Trash tab.` };
}

export async function restore(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || !item.deletedAt) return fail(`${def.singular} not found in Trash.`);
  if (item.slug && (await slugTaken(db, def, item.slug, id))) return slugError(def, item.slug);
  const [saved] = await db.update(contentItems).set({ deletedAt: null, updatedAt: new Date(), updatedBy: actorId }).where(eq(contentItems.id, id)).returning();
  await logActivity(db, { actorId, action: `${def.type}.restore`, entityType: def.type, entityId: id, summary: `Restored ${def.singular.toLowerCase()} “${saved.title}” from Trash` });
  return { ok: true, item: saved, message: `${def.singular} restored.` };
}

/** Permanent deletion. Only allowed for items already in Trash. */
export async function purge(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || !item.deletedAt) return fail("Only items in Trash can be deleted permanently.");
  await db.delete(contentItems).where(eq(contentItems.id, id));
  await logActivity(db, { actorId, action: `${def.type}.purge`, entityType: def.type, entityId: id, summary: `Permanently deleted ${def.singular.toLowerCase()} “${item.title}”` });
  return { ok: true, item, message: "Deleted permanently." };
}

export async function duplicate(db: Db, def: EntityDef, id: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  if (def.singleton) return fail("The profile cannot be duplicated.");
  const copy = structuredClone(workingCopy(item));
  copy[def.titleKey] = `${titleOf(def, copy)} (copy)`;
  if (def.slugKey) {
    const base = String(copy[def.slugKey] ?? "item");
    let candidate = `${base}-copy`;
    for (let n = 2; await slugTaken(db, def, candidate); n++) candidate = `${base}-copy-${n}`;
    copy[def.slugKey] = candidate;
  }
  const res = await createItem(db, def, actorId, copy);
  return res.ok ? { ...res, message: `Duplicated as a draft: “${res.item.title}”.` } : res;
}

/** Swaps position with the neighbouring item. */
export async function move(db: Db, def: EntityDef, id: string, actorId: string, direction: "up" | "down"): Promise<Result> {
  const rows = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.type, def.type), isNull(contentItems.deletedAt)))
    .orderBy(asc(contentItems.sortOrder), asc(contentItems.createdAt));
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return fail(`${def.singular} not found.`);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true, item: rows[i], message: "Already at the end." };
  const ordered = rows.map((r) => r.id);
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await db.transaction(async (tx) => {
    for (let n = 0; n < ordered.length; n++) await tx.update(contentItems).set({ sortOrder: n + 1 }).where(eq(contentItems.id, ordered[n]));
  });
  await logActivity(db, { actorId, action: `${def.type}.reorder`, entityType: def.type, entityId: id, summary: `Moved ${def.singular.toLowerCase()} “${rows[i].title}” ${direction}` });
  return { ok: true, item: rows[i], message: "Order updated." };
}

/** Saves the singleton (profile): creates it on first save. */
export async function saveSingleton(db: Db, def: EntityDef, actorId: string, input: Record<string, unknown>): Promise<Result> {
  const existing = await getSingleton(db, def);
  return existing ? saveDraft(db, def, existing.id, actorId, input) : createItem(db, def, actorId, input);
}

/* ---------------- revisions ---------------- */
/** Puts an earlier snapshot back as the draft. Nothing goes live until it is published. */
export async function restoreRevision(db: Db, def: EntityDef, id: string, revisionId: string, actorId: string): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  const rev = await getRevision(db, id, revisionId);
  if (!rev) return fail("Revision not found.");
  const res = await saveDraft(db, def, id, actorId, rev.data, "restore");
  if (!res.ok) return { ...res, error: res.error ?? "That revision no longer passes validation." };
  await logActivity(db, { actorId, action: `${def.type}.restore_revision`, entityType: def.type, entityId: id, summary: `Restored revision ${rev.version} of “${rev.title}” into the draft` });
  return { ok: true, item: res.item, message: `Revision ${rev.version} restored as a draft. Publish it to make it live.` };
}

/* ---------------- scheduled publishing ---------------- */
/** Sets (or clears, with null) the time a pending draft goes live automatically. */
export async function schedulePublish(db: Db, def: EntityDef, id: string, actorId: string, when: Date | null): Promise<Result> {
  const item = await getItem(db, def, id);
  if (!item || item.deletedAt) return fail(`${def.singular} not found.`);
  if (item.status === "archived") return fail("Archived items cannot be scheduled. Unarchive first.");
  if (when === null) {
    const [saved] = await db.update(contentItems).set({ publishAt: null, updatedAt: new Date(), updatedBy: actorId }).where(eq(contentItems.id, id)).returning();
    await logActivity(db, { actorId, action: `${def.type}.unschedule`, entityType: def.type, entityId: id, summary: `Cancelled scheduled publishing of “${saved.title}”` });
    return { ok: true, item: saved, message: "Schedule cancelled." };
  }
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 30_000) return fail("Choose a time in the future.");
  if (item.status === "published" && !item.draft) return fail("There are no unpublished changes to schedule.");
  const v = validate(def, workingCopy(item));
  if (!v.ok) return { ok: false, fieldErrors: v.fieldErrors, error: "Fix the highlighted fields before scheduling." };
  const [saved] = await db.update(contentItems).set({ publishAt: when, updatedAt: new Date(), updatedBy: actorId }).where(eq(contentItems.id, id)).returning();
  await logActivity(db, { actorId, action: `${def.type}.schedule`, entityType: def.type, entityId: id, summary: `Scheduled “${saved.title}” to publish at ${when.toISOString()}` });
  return { ok: true, item: saved, message: `Scheduled to publish at ${when.toUTCString()}.` };
}

/**
 * Publishes every item whose scheduled time has passed. Safe to call often and from several places
 * (admin pages, the cron endpoint, public reads). Returns the content types that changed so callers can
 * invalidate caches. An item that no longer validates has its schedule cleared and is reported.
 */
export async function publishDue(db: Db, now = new Date()) {
  const due = await db
    .select()
    .from(contentItems)
    .where(and(isNotNull(contentItems.publishAt), lte(contentItems.publishAt, now), isNull(contentItems.deletedAt)));
  const changed = new Set<ContentType>();
  const failed: { id: string; title: string; error: string }[] = [];
  for (const item of due) {
    const def = entities[item.type as ContentType];
    if (!def) continue;
    const eligible = item.status === "draft" || (item.status === "published" && Boolean(item.draft));
    const res: Result = eligible ? await publish(db, def, item.id, item.updatedBy ?? item.createdBy ?? "") : { ok: false, error: "No longer eligible." };
    if (res.ok) {
      changed.add(def.type);
      await logActivity(db, { action: `${def.type}.scheduled_publish`, entityType: def.type, entityId: item.id, summary: `Scheduled publish ran for “${item.title}”` });
    } else {
      await db.update(contentItems).set({ publishAt: null }).where(eq(contentItems.id, item.id));
      failed.push({ id: item.id, title: item.title, error: res.error ?? "Validation failed." });
      await logActivity(db, { action: `${def.type}.schedule_failed`, entityType: def.type, entityId: item.id, summary: `Scheduled publish of “${item.title}” was skipped: ${res.error ?? "validation failed"}` });
    }
  }
  return { changed: [...changed], failed };
}
