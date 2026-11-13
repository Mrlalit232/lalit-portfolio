import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { logActivity } from "@/lib/activity";

export { SEO_PAGES } from "./seo-pages";
import { SEO_PAGES } from "./seo-pages";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);

/** Plain text only: titles and descriptions are rendered in <title>/<meta> by React (escaped). */
const plain = (max: number) => z.string().trim().max(max).regex(/^[^<>]*$/, "Do not use < or > characters.");

export const pageSeoSchema = z.object({
  title: plain(70).optional(),
  description: plain(200).optional(),
  ogImage: uuid.optional(),
  noindex: z.boolean().optional(),
});
export type PageSeo = z.infer<typeof pageSeoSchema>;

export const seoSettingsSchema = z.object({
  /** Fallback description for pages without their own. */
  defaultDescription: plain(200).optional(),
  /** Social image used when a page has none. */
  defaultOgImage: uuid.optional(),
  pages: z.record(z.string(), pageSeoSchema).default({}),
});
export type SeoSettings = z.infer<typeof seoSettingsSchema>;

export const resumeSettingsSchema = z.object({ mediaId: uuid.optional() });
export type ResumeSettings = z.infer<typeof resumeSettingsSchema>;

export const SETTING_KEYS = { seo: "seo", resume: "resume" } as const;

export async function readSetting<T>(db: Db, key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : fallback;
}

export async function writeSetting(db: Db, key: string, value: Record<string, unknown>, actorId: string, summary: string) {
  await db
    .insert(siteSettings)
    .values({ key, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), updatedBy: actorId } });
  await logActivity(db, { actorId, action: `settings.${key}`, entityType: "settings", entityId: key, summary });
}

export const getSeoSettings = (db: Db) => readSetting(db, SETTING_KEYS.seo, seoSettingsSchema, { pages: {} });
export const getResumeSettings = (db: Db) => readSetting(db, SETTING_KEYS.resume, resumeSettingsSchema, {});

/** Saves SEO settings after removing empty values; unknown page paths are rejected. */
export async function saveSeoSettings(db: Db, actorId: string, input: unknown) {
  const parsed = seoSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid SEO settings." };
  const allowed = new Set<string>(SEO_PAGES.map((p) => p.path));
  const pages: Record<string, PageSeo> = {};
  for (const [path, v] of Object.entries(parsed.data.pages)) {
    if (!allowed.has(path)) return { ok: false as const, error: `Unknown page: ${path}` };
    const clean: PageSeo = {};
    if (v.title) clean.title = v.title;
    if (v.description) clean.description = v.description;
    if (v.ogImage) clean.ogImage = v.ogImage;
    if (v.noindex) clean.noindex = true;
    if (Object.keys(clean).length) pages[path] = clean;
  }
  const value: SeoSettings = { pages };
  if (parsed.data.defaultDescription) value.defaultDescription = parsed.data.defaultDescription;
  if (parsed.data.defaultOgImage) value.defaultOgImage = parsed.data.defaultOgImage;
  await writeSetting(db, SETTING_KEYS.seo, value, actorId, "Updated SEO settings");
  return { ok: true as const, value };
}
