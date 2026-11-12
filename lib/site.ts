/**
 * Central site configuration. Everything deployment-specific comes from
 * environment variables (see .env.example) so nothing personal or
 * environment-specific is hard-coded.
 */
const clean = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const site = {
  name: "Lalit Kumar Saini",
  shortName: "Lalit",
  brand: "Technology × Business × Creativity",
  title: "Lalit Kumar Saini — Technology × Business × Creativity",
  description:
    "Portfolio of Lalit Kumar Saini: web development, QA & test automation, client and business management, operations coordination and digital marketing.",
  /** Configurable production origin. Falls back to localhost for development only. */
  url: (clean(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000").replace(/\/$/, ""),
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
