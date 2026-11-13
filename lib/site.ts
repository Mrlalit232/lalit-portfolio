/**
 * Central site configuration. Everything deployment-specific comes from
 * environment variables (see .env.example) so nothing personal or
 * environment-specific is hard-coded.
 */
const clean = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

/**
 * Public origin used for canonical URLs, the sitemap and structured data.
 * Order: NEXT_PUBLIC_SITE_URL (set this for the real domain) > Vercel's production URL > localhost (dev only).
 */
function siteOrigin() {
  const explicit = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** False when canonical URLs would point at localhost. A production deployment must set NEXT_PUBLIC_SITE_URL. */
export const siteUrlConfigured = !siteOrigin().startsWith("http://localhost");

export const site = {
  name: "Lalit Kumar Saini",
  shortName: "Lalit",
  brand: "Technology × Business × Creativity",
  title: "Lalit Kumar Saini — Technology × Business × Creativity",
  description:
    "Portfolio of Lalit Kumar Saini: web development, QA & test automation, client and business management, operations coordination and digital marketing.",
  /** Configurable production origin. Falls back to localhost for development only. */
  url: siteOrigin(),
  /** Verified location. */
  location: { city: "Gurugram", region: "Haryana", country: "India", countryCode: "IN", label: "Gurugram, Haryana, India" },
  contact: {
    email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ?? "lalitkumarsaini510@gmail.com",
    linkedin: clean(process.env.NEXT_PUBLIC_LINKEDIN_URL) ?? "https://www.linkedin.com/in/lalit-kumar-saini-/",
    // GitHub profile (taken from the owner's own repository remote). Env var overrides it.
    github: clean(process.env.NEXT_PUBLIC_GITHUB_URL) ?? "https://github.com/Mrlalit232",
  },
  /** Path of the resume PDF inside /public. Add the file to enable the download button. */
  resumePdf: "/resume/Lalit-Kumar-Saini-Resume.pdf",
} as const;

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
