import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { hasHostedDb } from "@/db/client";
import { contentItems } from "@/db/schema";
import { getDb } from "@/lib/db";
import { site } from "@/lib/site";
import { credentials as staticCredentials } from "@/data/credentials";
import { experience as staticExperience } from "@/data/experience";
import { profile as staticProfile } from "@/data/profile";
import { projects as staticProjects } from "@/data/projects";
import { skillGroups as staticSkillGroups } from "@/data/skills";
import { ventures as staticVentures } from "@/data/ventures";
import type { Credential, Experience, Project, SkillGroup, Venture } from "@/data/types";
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
