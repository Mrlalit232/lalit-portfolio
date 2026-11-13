import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contentItems } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { credentials } from "@/data/credentials";
import { experience } from "@/data/experience";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { skillGroups } from "@/data/skills";
import { services } from "@/data/services";
import { ventures } from "@/data/ventures";
import { site } from "@/lib/site";
import { entities, slugOf, titleOf, type ContentType } from "./registry";

type Seed = { type: ContentType; data: Record<string, unknown> };

function buildSeeds(): Seed[] {
  const seeds: Seed[] = [];
  seeds.push({
    type: "profile",
    data: {
      name: profile.name,
      headline: profile.headline,
      intro: profile.intro,
      aboutEducation: profile.about.education,
      aboutParagraphs: profile.about.paragraphs,
      interests: profile.about.interests,
      focusAreas: profile.focusAreas,
      email: site.contact.email,
      location: site.location.label,
      linkedin: site.contact.linkedin,
      github: site.contact.github,
    },
  });
  for (const p of projects) seeds.push({ type: "project", data: { ...p } });
  for (const v of ventures) seeds.push({ type: "venture", data: { ...v } });
  for (const sv of services) seeds.push({ type: "service", data: { ...sv } });
  for (const e of experience) seeds.push({ type: "experience", data: { ...e } });
  for (const g of skillGroups) seeds.push({ type: "skillGroup", data: { ...g } });
  for (const c of credentials) {
    if (c.kind === "Education") seeds.push({ type: "education", data: { title: c.title, issuer: c.issuer, note: c.note } });
    else seeds.push({ type: "certification", data: { title: c.title, issuer: c.issuer, kind: c.kind, note: c.note } });
  }
  return seeds;
}

/**
 * Imports the existing static content (data/*.ts) as PUBLISHED items.
 * Idempotent and non-destructive: an item that already exists (same type + slug/title, including
 * in Trash) is skipped, so re-running never overwrites edits made in the admin panel.
 * Testimonials are intentionally not seeded.
 */
export async function seedContent(db: Db, actorId?: string) {
  const counts = { created: 0, skipped: 0 };
  const order: Partial<Record<ContentType, number>> = {};
  for (const seed of buildSeeds()) {
    const def = entities[seed.type];
    const parsed = def.schema.safeParse(JSON.parse(JSON.stringify(seed.data)));
    if (!parsed.success) {
      throw new Error(`Seed data for ${def.type} “${titleOf(def, seed.data)}” is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    const data = parsed.data as Record<string, unknown>;
    const slug = slugOf(def, data);
    const title = titleOf(def, data);
    order[def.type] = (order[def.type] ?? 0) + 1;

    const where = slug
      ? and(eq(contentItems.type, def.type), eq(contentItems.slug, slug))
      : and(eq(contentItems.type, def.type), eq(contentItems.title, title));
    const [existing] = await db.select({ id: contentItems.id }).from(contentItems).where(where).limit(1);
    if (existing) {
      counts.skipped++;
      continue;
    }
    await db.insert(contentItems).values({
      type: def.type,
      slug,
      title,
      status: "published",
      data,
      draft: null,
      sortOrder: order[def.type]!,
      publishedAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    });
    counts.created++;
  }
  await logActivity(db, { actorId, action: "content.seed", summary: `Imported existing content: ${counts.created} created, ${counts.skipped} already present` });
  return counts;
}

export async function hasAnyContent(db: Db) {
  const [row] = await db.select({ id: contentItems.id }).from(contentItems).where(isNull(contentItems.deletedAt)).limit(1);
  return Boolean(row);
}

/** Default profile values (from the static files), used to prefill the profile form before the first save. */
export const profileDefaults = () => buildSeeds()[0].data;

/** Where a published item appears on the public site, for "View on site" links. */
export function publicPath(type: ContentType, data: Record<string, unknown>) {
  switch (type) {
    case "project":
      return `/projects/${String(data.slug ?? "")}`;
    case "venture":
      return `/ventures#${String(data.id ?? "")}`;
    case "service":
      return "/services";
    case "experience":
      return "/experience";
    case "skillGroup":
    case "education":
    case "certification":
      return "/skills";
    case "profile":
    case "testimonial":
      return "/";
  }
}
