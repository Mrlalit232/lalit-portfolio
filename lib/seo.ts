import type { Metadata } from "next";
import { absoluteUrl, site } from "./site";

type PageSeo = {
  title: string;
  description: string;
  path: string;
  /** Use for pages that should not be indexed. */
  noindex?: boolean;
  /** Use the title exactly as given, without the "| Name" suffix (home page). */
  absoluteTitle?: boolean;
};

/** Builds consistent page metadata: title, description, canonical and Open Graph. */
export function buildMetadata({ title, description, path, noindex, absoluteTitle }: PageSeo): Metadata {
  const full = absoluteTitle ? title : `${title} | ${site.name}`;
  const url = absoluteUrl(path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: site.name,
      title: full,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
    },
  };
}

export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  jobTitle: "Web Developer & QA Learner",
  description: site.description,
  knowsAbout: ["Web development", "Software testing", "Test automation", "Client management", "Digital marketing"],
  sameAs: [site.contact.linkedin, site.contact.github].filter(Boolean),
};
