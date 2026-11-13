import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contentItems, media, siteSettings } from "@/db/schema";
import { logActivity } from "@/lib/activity";

/** Upload limits. Kept small because files are stored in Postgres (free-tier friendly). */
export const MEDIA_MAX_BYTES = 3 * 1024 * 1024;

export type MediaKind = "image" | "pdf";
const TYPES: Record<string, { mime: string; kind: MediaKind; ext: string[] }> = {
  png: { mime: "image/png", kind: "image", ext: ["png"] },
  jpeg: { mime: "image/jpeg", kind: "image", ext: ["jpg", "jpeg"] },
  gif: { mime: "image/gif", kind: "image", ext: ["gif"] },
  webp: { mime: "image/webp", kind: "image", ext: ["webp"] },
  pdf: { mime: "application/pdf", kind: "pdf", ext: ["pdf"] },
};

/** Detects the real type from the file's first bytes. The browser-supplied type and the extension are NOT trusted. */
export function sniffType(b: Uint8Array): keyof typeof TYPES | null {
  const eq4 = (o: number, s: string) => s.split("").every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b.length >= 8 && b[0] === 0x89 && eq4(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && (eq4(0, "GIF87a") || eq4(0, "GIF89a"))) return "gif";
  if (b.length >= 12 && eq4(0, "RIFF") && eq4(8, "WEBP")) return "webp";
  if (b.length >= 5 && eq4(0, "%PDF-")) return "pdf";
  return null;
}

/** Safe display/download name: no path parts, no control or special characters. */
export function sanitizeFilename(name: string, fallbackExt: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/^\.+/, "").slice(0, 80);
  const stem = cleaned.replace(/\.[^.]*$/, "") || "file";
  return `${stem}.${fallbackExt}`;
}

export type UploadResult = { ok: true; row: typeof media.$inferSelect } | { ok: false; error: string };

export async function saveUpload(db: Db, actorId: string, input: { filename: string; bytes: Uint8Array; alt?: string }): Promise<UploadResult> {
  if (input.bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (input.bytes.length > MEDIA_MAX_BYTES) return { ok: false, error: `The file is larger than ${MEDIA_MAX_BYTES / 1024 / 1024} MB.` };
  const kind = sniffType(input.bytes);
  if (!kind) return { ok: false, error: "Only PNG, JPEG, GIF, WebP images and PDF files are allowed. SVG and other types are not accepted." };
  const t = TYPES[kind];
  const filename = sanitizeFilename(input.filename, t.ext[0]);
  const alt = (input.alt ?? "").replace(/[<>]/g, "").slice(0, 200);
  const [row] = await db.insert(media).values({ filename, mime: t.mime, size: input.bytes.length, alt, bytes: Buffer.from(input.bytes), createdBy: actorId }).returning();
  await logActivity(db, { actorId, action: "media.upload", entityType: "media", entityId: row.id, summary: `Uploaded ${filename} (${Math.round(row.size / 1024)} KB)` });
  return { ok: true, row };
}

/** Listing without the bytes. */
export async function listMedia(db: Db, opts: { kind?: MediaKind } = {}) {
  const rows = await db
    .select({ id: media.id, filename: media.filename, mime: media.mime, size: media.size, alt: media.alt, createdAt: media.createdAt })
    .from(media)
    .where(isNull(media.deletedAt))
    .orderBy(desc(media.createdAt));
  return opts.kind ? rows.filter((r) => (opts.kind === "pdf" ? r.mime === "application/pdf" : r.mime.startsWith("image/"))) : rows;
}

export async function getMediaFile(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(media).where(and(eq(media.id, id), isNull(media.deletedAt))).limit(1);
  return row ?? null;
}

export async function updateAlt(db: Db, actorId: string, id: string, alt: string) {
  const clean = alt.replace(/[<>]/g, "").slice(0, 200);
  const [row] = await db.update(media).set({ alt: clean }).where(and(eq(media.id, id), isNull(media.deletedAt))).returning({ id: media.id });
  if (row) await logActivity(db, { actorId, action: "media.alt", entityType: "media", entityId: id, summary: "Updated media description" });
  return Boolean(row);
}

/** Where a file is referenced (content or settings), so it is never deleted while in use. */
export async function mediaUsage(db: Db, id: string) {
  const needle = `%${id}%`;
  const [items, settings] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(contentItems).where(and(isNull(contentItems.deletedAt), sql`(${contentItems.data}::text like ${needle} or ${contentItems.draft}::text like ${needle})`)),
    db.select({ key: siteSettings.key }).from(siteSettings).where(sql`${siteSettings.value}::text like ${needle}`),
  ]);
  return { content: Number(items[0]?.n ?? 0), settings: settings.map((s) => s.key) };
}

export async function deleteMedia(db: Db, actorId: string, id: string) {
  const file = await getMediaFile(db, id);
  if (!file) return { ok: false as const, error: "File not found." };
  const use = await mediaUsage(db, id);
  if (use.content > 0 || use.settings.length > 0) {
    return { ok: false as const, error: `This file is in use (${[use.content ? `${use.content} content item(s)` : "", use.settings.length ? `settings: ${use.settings.join(", ")}` : ""].filter(Boolean).join("; ")}). Remove it there first.` };
  }
  await db.delete(media).where(eq(media.id, id));
  await logActivity(db, { actorId, action: "media.delete", entityType: "media", entityId: id, summary: `Deleted ${file.filename}` });
  return { ok: true as const };
}

export const mediaUrl = (id: string) => `/media/${id}`;
