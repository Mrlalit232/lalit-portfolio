import { z } from "zod";

/* ---------- primitives ---------- */
const text = (max = 300) => z.string().trim().min(1, "Required").max(max, `Max ${max} characters`);
const optText = (max = 300) =>
  z
    .string()
    .trim()
    .max(max, `Max ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));
const list = (maxItems = 40, itemMax = 600) => z.array(z.string().trim().min(1).max(itemMax)).max(maxItems);
const slug = z
  .string()
  .trim()
  .min(2, "Required")
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens (e.g. my-project)");
/** Only http(s), site-relative paths and mailto: are allowed, so `javascript:` URLs can never be stored. */
const href = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^(https?:\/\/|\/|mailto:)/i.test(v), "Use an https:// link, a path starting with /, or mailto:");
const optHref = href.optional().or(z.literal("").transform(() => undefined));

/* ---------- entity schemas ---------- */
export const projectSchema = z.object({
  slug,
  title: text(120),
  category: text(40),
  tagline: text(200),
  summary: text(1000),
  status: text(80),
  featured: z.boolean().default(false),
  stack: list(30, 60),
  links: z.array(z.object({ label: text(60), href })).max(10),
  caseStudy: z.object({
    overview: list(10, 1500),
    objective: list(10, 1500),
    solution: list(10, 1500),
    role: list(10, 1500),
    implementation: list(30),
    challenges: list(20).optional(),
    implemented: list(30),
    planned: list(30),
    future: list(30),
  }),
  screenshots: z.array(z.object({ src: href, alt: text(200) })).max(12),
  architecture: z.array(z.object({ label: text(60), detail: text(120) })).max(10).optional(),
});

export const ventureSchema = z.object({
  id: slug,
  name: text(120),
  status: text(80),
  stage: z.enum(["active", "concept"]),
  tagline: text(200),
  summary: text(1200),
  listTitle: text(80),
  items: list(20),
  secondaryTitle: optText(80),
  secondaryItems: list(20).optional(),
  note: text(400),
  link: z.object({ label: text(60), href }).optional(),
});

export const serviceSchema = z.object({
  id: slug,
  title: text(80),
  summary: text(300),
  includes: list(12, 150),
  idealFor: text(200),
});

export const experienceSchema = z.object({
  company: text(120),
  role: text(120),
  period: text(80),
  duration: text(80),
  summary: text(1500),
  responsibilities: list(30),
  transferable: list(30),
});

export const educationSchema = z.object({ title: text(160), issuer: text(160), note: optText(300) });

export const certificationSchema = z.object({
  title: text(160),
  issuer: text(160),
  kind: z.enum(["Certification", "Participation", "Activity"]),
  note: optText(300),
});

export const skillLevels = ["Working knowledge", "Learning & practising", "Applied in projects", "Applied in work"] as const;
export const skillGroupSchema = z.object({
  id: slug,
  title: text(80),
  blurb: text(300),
  accent: z.enum(["tech", "business", "creative"]),
  skills: z.array(z.object({ name: text(80), level: z.enum(skillLevels) })).max(60),
});

export const testimonialSchema = z.object({
  name: text(100),
  designation: text(120),
  organization: text(120),
  text: text(1500),
  image: optHref,
});

export const profileSchema = z.object({
  name: text(100),
  headline: text(120),
  intro: text(600),
  aboutEducation: text(500),
  aboutParagraphs: list(8, 1500),
  interests: list(20, 80),
  focusAreas: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        title: text(80),
        accent: z.enum(["tech", "business", "creative"]),
        body: text(300),
      }),
    )
    .max(10),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: optText(40),
  location: text(120),
  linkedin: href,
  github: href,
});

export type ProjectData = z.infer<typeof projectSchema>;
export type VentureData = z.infer<typeof ventureSchema>;
export type ServiceData = z.infer<typeof serviceSchema>;
export type ExperienceData = z.infer<typeof experienceSchema>;
export type EducationData = z.infer<typeof educationSchema>;
export type CertificationData = z.infer<typeof certificationSchema>;
export type SkillGroupData = z.infer<typeof skillGroupSchema>;
export type TestimonialData = z.infer<typeof testimonialSchema>;
export type ProfileData = z.infer<typeof profileSchema>;
