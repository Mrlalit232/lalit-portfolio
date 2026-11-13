import type { MetadataRoute } from "next";
import { primaryNav, resumeNav } from "@/data/navigation";
import { getProjects } from "@/lib/content/public";
import { absoluteUrl, site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  const pages = [...primaryNav, resumeNav].map((p) => ({
    // Home is the bare origin so it matches the canonical URL exactly (no trailing slash).
    url: p.href === "/" ? site.url : absoluteUrl(p.href),
    changeFrequency: "monthly" as const,
    priority: p.href === "/" ? 1 : 0.7,
  }));
  const caseStudies = projects.map((p) => ({
    url: absoluteUrl(`/projects/${p.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...pages, ...caseStudies];
}
