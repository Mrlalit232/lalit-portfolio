import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { hasHostedDb } from "@/db/client";
import { contentItems } from "@/db/schema";
import { getDb } from "@/lib/db";
import { site } from "@/lib/site";
import { resumePdfAvailable } from "@/lib/resume";
import { media } from "@/db/schema";
import { getResumeSettings, getSeoSettings, type SeoSettings } from "@/lib/settings";
import { credentials as staticCredentials } from "@/data/credentials";
import { experience as staticExperience } from "@/data/experience";
import { profile as staticProfile } from "@/data/profile";
import { projects as staticProjects } from "@/data/projects";
import { skillGroups as staticSkillGroups } from "@/data/skills";
import { services as staticServices } from "@/data/services";
import { ventures as staticVentures } from "@/data/ventures";
import type { Credential, Experience, Project, Service, SkillGroup, Venture } from "@/data/types";
import type { ProfileData, TestimonialData } from "./schemas";
import type { ContentType } from "./registry";
import { hasAnyContent } from "./seed";

/**
 * PUBLIC read API. Only PUBLISHED, non-deleted rows are ever returned, and always the live `data`
 * (never the draft overlay). If the database is unavailable or has never been seeded, the original
 * static content in data/*.ts is served, so the portfolio stays up.
 * Results are cached with tags; admin mutations call updateTag("content:<type>").
 */
function dbAllowed() {
  return hasHostedDb() || process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DB === "1";
}

async function tryDb(): Promise<Db | null> {
  if (!dbAllowed()) return null;
  try {
    return await getDb();
  } catch {
    return null;
  }
}

/** True if ANY row (any status, including Trash) exists for the type, so an intentionally empty list is respected. */
async function typeHasRows(type: ContentType) {
  const db = await tryDb();
  if (!db) return false;
  try {
    const [row] = await db.select({ id: contentItems.id }).from(contentItems).where(eq(contentItems.type, type)).limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}

/** Live data of published items, or null when the static fallback should be used. */
async function readPublished(type: ContentType): Promise<Record<string, unknown>[] | null> {
  const db = await tryDb();
  if (!db) return null;
  try {
    if (!(await hasAnyContent(db))) return null; // never seeded -> static content
    const rows = await db
      .select({ data: contentItems.data })
      .from(contentItems)
      .where(and(eq(contentItems.type, type), eq(contentItems.status, "published"), isNull(contentItems.deletedAt)))
      .orderBy(asc(contentItems.sortOrder), asc(contentItems.createdAt));
    return rows.map((r) => r.data);
  } catch (error) {
    console.error(`Public content read failed for ${type}; using static fallback:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getProjects(): Promise<Project[]> {
  "use cache";
  cacheTag("content:project");
  cacheLife("minutes");
  const rows = await readPublished("project");
  return rows ? (rows as unknown as Project[]) : staticProjects;
}

export async function getProject(slug: string): Promise<Project | undefined> {
  return (await getProjects()).find((p) => p.slug === slug);
}

/**
 * Services were added to the CMS after the first release. Until they are imported (`npm run db:seed`) there are
 * no service rows at all, and the built-in services are served instead of an empty page.
 */
export async function getServices(): Promise<Service[]> {
  "use cache";
  cacheTag("content:service");
  cacheLife("minutes");
  const rows = await readPublished("service");
  if (!rows) return staticServices;
  if (rows.length === 0 && !(await typeHasRows("service"))) return staticServices;
  return rows as unknown as Service[];
}

export async function getVentures(): Promise<Venture[]> {
  "use cache";
  cacheTag("content:venture");
  cacheLife("minutes");
  const rows = await readPublished("venture");
  return rows ? (rows as unknown as Venture[]) : staticVentures;
}

export async function getExperience(): Promise<Experience[]> {
  "use cache";
  cacheTag("content:experience");
  cacheLife("minutes");
  const rows = await readPublished("experience");
  return rows ? (rows as unknown as Experience[]) : staticExperience;
}

export async function getSkillGroups(): Promise<SkillGroup[]> {
  "use cache";
  cacheTag("content:skillGroup");
  cacheLife("minutes");
  const rows = await readPublished("skillGroup");
  return rows ? (rows as unknown as SkillGroup[]) : staticSkillGroups;
}

/** Education first, then certifications / participation / activities. */
export async function getCredentials(): Promise<Credential[]> {
  "use cache";
  cacheTag("content:education", "content:certification");
  cacheLife("minutes");
  const [edu, certs] = await Promise.all([readPublished("education"), readPublished("certification")]);
  if (!edu || !certs) return staticCredentials;
  return [
    ...edu.map((e) => ({ ...(e as { title: string; issuer: string; note?: string }), kind: "Education" as const })),
    ...(certs as unknown as Credential[]),
  ];
}

/** Genuine testimonials only. Empty when none are published, and the section is then hidden. */
export async function getTestimonials(): Promise<TestimonialData[]> {
  "use cache";
  cacheTag("content:testimonial");
  cacheLife("minutes");
  return ((await readPublished("testimonial")) ?? []) as unknown as TestimonialData[];
}

export type PublicProfile = {
  name: string;
  headline: string;
  intro: string;
  focusAreas: typeof staticProfile.focusAreas;
  about: { education: string; paragraphs: string[]; interests: string[] };
  contact: { email: string; phone?: string; location: string; linkedin: string; github: string };
};

export async function getProfile(): Promise<PublicProfile> {
  "use cache";
  cacheTag("content:profile");
  cacheLife("minutes");
  const rows = await readPublished("profile");
  const p = rows?.[0] as ProfileData | undefined;
  if (!p) {
    return {
      ...staticProfile,
      contact: { email: site.contact.email, location: site.location.label, linkedin: site.contact.linkedin, github: site.contact.github },
    };
  }
  return {
    name: p.name,
    headline: p.headline,
    intro: p.intro,
    focusAreas: p.focusAreas as typeof staticProfile.focusAreas,
    about: { education: p.aboutEducation, paragraphs: p.aboutParagraphs, interests: p.interests },
    contact: { email: p.email, phone: p.phone, location: p.location, linkedin: p.linkedin, github: p.github },
  };
}

/** CMS-managed SEO overrides. Empty (defaults only) when the database is unavailable. */
export async function getPublicSeo(): Promise<SeoSettings> {
  "use cache";
  cacheTag("settings");
  cacheLife("minutes");
  const db = await tryDb();
  if (!db) return { pages: {} };
  try {
    return await getSeoSettings(db);
  } catch {
    return { pages: {} };
  }
}

/**
 * Where the resume PDF can be downloaded, or null when none exists: the file chosen in the Resume manager
 * (stored in the media library), otherwise the static file in /public if present.
 */
export async function getResumeHref(): Promise<string | null> {
  "use cache";
  cacheTag("settings");
  cacheLife("minutes");
  const db = await tryDb();
  if (db) {
    try {
      const { mediaId } = await getResumeSettings(db);
      if (mediaId) {
        const [row] = await db.select({ id: media.id, mime: media.mime }).from(media).where(and(eq(media.id, mediaId), isNull(media.deletedAt))).limit(1);
        if (row?.mime === "application/pdf") return `/media/${row.id}`;
      }
    } catch {
      // fall through to the static file
    }
  }
  return resumePdfAvailable() ? site.resumePdf : null;
}
