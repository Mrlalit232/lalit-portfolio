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
  /** Social sharing image (path or absolute URL). Defaults to the generated brand card. */
  image?: string;
};

/** Meta descriptions over ~160 characters are truncated by search engines; clip at a word boundary. */
export function clipDescription(text: string, max = 160) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-\s]+$/, "")}…`;
}

const ogImage = { url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: `${site.name}: ${site.brand}` };

/** Builds consistent page metadata: title, description, canonical and Open Graph. */
export function buildMetadata({ title, description: rawDescription, path, noindex, absoluteTitle, image }: PageSeo): Metadata {
  const description = clipDescription(rawDescription);
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
      images: [image ? { url: image.startsWith("/") ? absoluteUrl(image) : image, alt: `${site.name}: ${site.brand}` } : ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [image ? (image.startsWith("/") ? absoluteUrl(image) : image) : ogImage.url],
    },
  };
}

const personId = `${site.url}/#person`;
const websiteId = `${site.url}/#website`;

export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": personId,
  name: site.name,
  alternateName: "Lalit Saini",
  url: site.url,
  jobTitle: "Web Developer & QA Learner",
  homeLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: site.location.city,
      addressRegion: site.location.region,
      addressCountry: site.location.countryCode,
    },
  },
  alumniOf: { "@type": "CollegeOrUniversity", name: "St. Andrews Institute of Technology & Management" },
  description: site.description,
  knowsAbout: ["Web development", "Software testing", "Test automation", "Python", "Client management", "Digital marketing"],
  sameAs: [site.contact.linkedin, site.contact.github].filter(Boolean),
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": websiteId,
  url: site.url,
  name: `${site.name} Portfolio`,
  inLanguage: "en",
  publisher: { "@id": personId },
};

/** ProfilePage for pages whose main subject is the person (home, about). */
export function profilePageJsonLd(path: string, name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: absoluteUrl(path),
    name,
    isPartOf: { "@id": websiteId },
    mainEntity: { "@id": personId },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** A project is SoftwareSourceCode when a public repository link exists, otherwise a CreativeWork. */
export function projectJsonLd(p: { slug: string; title: string; summary: string; stack: string[]; links: { label: string; href: string }[] }) {
  const repo = p.links.find((l) => /github\.com\//i.test(l.href));
  const base = {
    "@context": "https://schema.org",
    "@type": repo ? "SoftwareSourceCode" : "CreativeWork",
    name: p.title,
    description: p.summary,
    url: absoluteUrl(`/projects/${p.slug}`),
    author: { "@id": personId },
    keywords: p.stack.join(", "),
    ...(repo ? { codeRepository: repo.href, programmingLanguage: p.stack.slice(0, 3) } : {}),
  };
  return base;
}

/** Serialises JSON-LD safely for inline <script> (escapes "<"). */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
