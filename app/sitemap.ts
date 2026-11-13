import type { MetadataRoute } from "next";
import { primaryNav, resumeNav } from "@/data/navigation";
import { projects } from "@/data/projects";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [...primaryNav, resumeNav].map((p) => ({
    url: absoluteUrl(p.href),
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
