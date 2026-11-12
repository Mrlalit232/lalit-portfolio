import type { z } from "zod";
import type { FieldDef } from "./codec";
import {
  certificationSchema,
  educationSchema,
  experienceSchema,
  profileSchema,
  projectSchema,
  skillGroupSchema,
  skillLevels,
  testimonialSchema,
  ventureSchema,
} from "./schemas";

export type ContentType =
  | "project"
  | "venture"
  | "experience"
  | "education"
  | "certification"
  | "skillGroup"
  | "testimonial"
  | "profile";

export type EntityDef = {
  type: ContentType;
  /** URL segment under /admin and display names. */
  module: string;
  singular: string;
  plural: string;
  description: string;
  schema: z.ZodType<Record<string, unknown>>;
  /** Data key that holds the unique public slug/id, when the type has one. */
  slugKey?: "slug" | "id";
  /** Field used for list titles. */
  titleKey: string;
  /** Short secondary line in lists. */
  subtitle: (data: Record<string, unknown>) => string;
  singleton?: boolean;
  fields: FieldDef[];
};

const s = (v: unknown) => (typeof v === "string" ? v : "");
const opt = (value: string) => ({ value, label: value });
const accentOptions = [opt("tech"), opt("business"), opt("creative")];

const lines = "One per line.";
const paragraphs = "Separate paragraphs with a blank line.";

export const entities: Record<ContentType, EntityDef> = {
  project: {
    type: "project",
    module: "projects",
    singular: "Project",
    plural: "Projects",
    description: "Portfolio projects and their case studies.",
    schema: projectSchema as unknown as EntityDef["schema"],
    slugKey: "slug",
    titleKey: "title",
    subtitle: (d) => `${s(d.category)} · /projects/${s(d.slug)}`,
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, group: "Basics" },
      { name: "slug", label: "URL slug", kind: "text", required: true, help: "Lowercase, hyphens. Becomes /projects/<slug>.", placeholder: "my-project" },
      { name: "category", label: "Category", kind: "text", required: true, help: "Used for the filter on the Projects page. Reuse an existing category to group projects." },
      { name: "tagline", label: "Tagline", kind: "text", required: true },
      { name: "summary", label: "Summary", kind: "textarea", rows: 4, required: true },
      { name: "status", label: "Status label", kind: "text", required: true, help: "Shown on the card, e.g. “Live front-end demo”. Be accurate." },
      { name: "featured", label: "Featured on the homepage", kind: "boolean" },
      { name: "stack", label: "Technologies used", kind: "lines", help: lines, rows: 5, group: "Technology & links" },
      { name: "links", label: "Links", kind: "tuples", keys: ["label", "href"], help: "One per line: Label | https://url (live demo, GitHub repository…).", rows: 3 },
      { name: "caseStudy.overview", label: "Overview", kind: "paragraphs", help: paragraphs, rows: 5, group: "Case study" },
      { name: "caseStudy.objective", label: "Problem or objective", kind: "paragraphs", help: paragraphs, rows: 4 },
      { name: "caseStudy.solution", label: "Proposed solution", kind: "paragraphs", help: paragraphs, rows: 4 },
      { name: "caseStudy.role", label: "My role", kind: "paragraphs", help: `${paragraphs} State your real role only.`, rows: 3 },
      { name: "caseStudy.implementation", label: "Implementation approach", kind: "lines", help: lines, rows: 5 },
      { name: "caseStudy.implemented", label: "Built today", kind: "lines", help: `${lines} Features that exist now.`, rows: 5 },
      { name: "caseStudy.planned", label: "Planned / not claimed", kind: "lines", help: `${lines} Be honest about what is not built.`, rows: 3 },
      { name: "caseStudy.challenges", label: "Challenges & solutions", kind: "lines", help: `${lines} Only challenges you actually experienced. Leave empty to hide the section.`, rows: 3 },
      { name: "caseStudy.future", label: "Future improvements", kind: "lines", help: lines, rows: 4 },
      { name: "screenshots", label: "Screenshots", kind: "tuples", keys: ["src", "alt"], help: "One per line: /projects/shot.png | Describe the image. Real screenshots only.", rows: 3, group: "Visuals" },
      { name: "architecture", label: "Architecture steps", kind: "tuples", keys: ["label", "detail"], help: "One per line, in order: Label | Short detail. Optional.", rows: 4 },
    ],
  },
  venture: {
    type: "venture",
    module: "ventures",
    singular: "Venture",
    plural: "Ventures",
    description: "Entrepreneurial initiatives, each with an accurate status.",
    schema: ventureSchema as unknown as EntityDef["schema"],
    slugKey: "id",
    titleKey: "name",
    subtitle: (d) => `${s(d.status)}`,
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "id", label: "Anchor ID", kind: "text", required: true, help: "Lowercase, hyphens. Used for the link anchor on the Ventures page." },
      { name: "stage", label: "Stage", kind: "select", options: [{ value: "active", label: "Active work" }, { value: "concept", label: "Concept" }], required: true, help: "Active = work in progress. Concept = planning or exploring, not operating." },
      { name: "status", label: "Status label", kind: "text", required: true, help: "Be accurate: do not imply a launch, revenue or customers unless true." },
      { name: "tagline", label: "Tagline", kind: "text", required: true },
      { name: "summary", label: "Summary", kind: "textarea", rows: 4, required: true },
      { name: "listTitle", label: "List heading", kind: "text", required: true, placeholder: "Services / Proposed features" },
      { name: "items", label: "List items", kind: "lines", help: lines, rows: 5 },
      { name: "secondaryTitle", label: "Second list heading (optional)", kind: "text" },
      { name: "secondaryItems", label: "Second list items (optional)", kind: "lines", help: lines, rows: 3 },
      { name: "note", label: "Honest status note", kind: "textarea", rows: 2, required: true },
      { name: "link.label", label: "Link label (optional)", kind: "text" },
      { name: "link.href", label: "Link URL (optional)", kind: "text" },
    ],
  },
  experience: {
    type: "experience",
    module: "experience",
    singular: "Experience",
    plural: "Experience",
    description: "Professional roles.",
    schema: experienceSchema as unknown as EntityDef["schema"],
    titleKey: "company",
    subtitle: (d) => `${s(d.role)} · ${s(d.period)}`,
    fields: [
      { name: "company", label: "Company", kind: "text", required: true },
      { name: "role", label: "Role", kind: "text", required: true },
      { name: "period", label: "Period", kind: "text", required: true, placeholder: "20 March 2026 – 6 September 2026" },
      { name: "duration", label: "Duration", kind: "text", required: true },
      { name: "summary", label: "Description", kind: "textarea", rows: 5, required: true },
      { name: "responsibilities", label: "Responsibilities", kind: "lines", help: lines, rows: 8 },
      { name: "transferable", label: "Transferable skills", kind: "lines", help: lines, rows: 6 },
    ],
  },
  education: {
    type: "education",
    module: "education",
    singular: "Education",
    plural: "Education",
    description: "Degrees and academic qualifications.",
    schema: educationSchema as unknown as EntityDef["schema"],
    titleKey: "title",
    subtitle: (d) => s(d.issuer),
    fields: [
      { name: "title", label: "Degree / programme", kind: "text", required: true },
      { name: "issuer", label: "Institution", kind: "text", required: true },
      { name: "note", label: "Note (optional)", kind: "textarea", rows: 2, help: "e.g. “Final-year / graduate level.” Only verified details." },
    ],
  },
  certification: {
    type: "certification",
    module: "certifications",
    singular: "Certification",
    plural: "Certifications",
    description: "Certifications, participation and activities. Participation is not an award.",
    schema: certificationSchema as unknown as EntityDef["schema"],
    titleKey: "title",
    subtitle: (d) => `${s(d.kind)} · ${s(d.issuer)}`,
    fields: [
      { name: "title", label: "Name", kind: "text", required: true },
      { name: "issuer", label: "Issuing organisation", kind: "text", required: true },
      { name: "kind", label: "Type", kind: "select", options: ["Certification", "Participation", "Activity"].map(opt), required: true, help: "Choose “Participation” unless you actually earned a certificate or award." },
      { name: "note", label: "Note (optional)", kind: "textarea", rows: 2 },
    ],
  },
  skillGroup: {
    type: "skillGroup",
    module: "skills",
    singular: "Skill group",
    plural: "Skills",
    description: "Skill categories and the skills within them.",
    schema: skillGroupSchema as unknown as EntityDef["schema"],
    slugKey: "id",
    titleKey: "title",
    subtitle: (d) => `${Array.isArray(d.skills) ? d.skills.length : 0} skills`,
    fields: [
      { name: "title", label: "Category name", kind: "text", required: true },
      { name: "id", label: "ID", kind: "text", required: true, help: "Lowercase, hyphens (e.g. web)." },
      { name: "blurb", label: "Short description", kind: "textarea", rows: 2, required: true },
      { name: "accent", label: "Accent colour", kind: "select", options: accentOptions, required: true },
      { name: "skills", label: "Skills", kind: "tuples", keys: ["name", "level"], rows: 12, help: `One per line: Skill | Level. Levels: ${skillLevels.join(" · ")}. Describe how you have actually used each skill.` },
    ],
  },
  testimonial: {
    type: "testimonial",
    module: "testimonials",
    singular: "Testimonial",
    plural: "Testimonials",
    description: "Genuine testimonials only. The public section stays hidden until one is published.",
    schema: testimonialSchema as unknown as EntityDef["schema"],
    titleKey: "name",
    subtitle: (d) => `${s(d.designation)}, ${s(d.organization)}`,
    fields: [
      { name: "name", label: "Person name", kind: "text", required: true },
      { name: "designation", label: "Designation", kind: "text", required: true },
      { name: "organization", label: "Organisation", kind: "text", required: true },
      { name: "text", label: "Testimonial", kind: "textarea", rows: 6, required: true, help: "Only add testimonials you actually received, with the person’s permission." },
      { name: "image", label: "Photo URL (optional)", kind: "text" },
    ],
  },
  profile: {
    type: "profile",
    module: "profile",
    singular: "Profile",
    plural: "Profile",
    description: "Your name, headline, introduction, about text and contact details.",
    schema: profileSchema as unknown as EntityDef["schema"],
    titleKey: "name",
    singleton: true,
    subtitle: (d) => s(d.headline),
    fields: [
      { name: "name", label: "Full name", kind: "text", required: true, group: "Identity" },
      { name: "headline", label: "Professional headline", kind: "text", required: true },
      { name: "intro", label: "Short introduction", kind: "textarea", rows: 3, required: true },
      { name: "aboutEducation", label: "Education statement", kind: "textarea", rows: 2, required: true, group: "About" },
      { name: "aboutParagraphs", label: "About description", kind: "paragraphs", help: paragraphs, rows: 10 },
      { name: "interests", label: "Interests", kind: "lines", help: lines, rows: 6 },
      { name: "focusAreas", label: "Core capabilities", kind: "tuples", keys: ["id", "title", "accent", "body"], rows: 6, help: "One per line: id | Title | accent (tech, business or creative) | Description." },
      { name: "email", label: "Email", kind: "text", required: true, group: "Contact" },
      { name: "phone", label: "Phone (optional)", kind: "text" },
      { name: "location", label: "Location", kind: "text", required: true },
      { name: "linkedin", label: "LinkedIn URL", kind: "text", required: true },
      { name: "github", label: "GitHub URL", kind: "text", required: true },
    ],
  },
};

export const contentTypes = Object.keys(entities) as ContentType[];

export function entityByModule(module: string) {
  return Object.values(entities).find((e) => e.module === module);
}

export function titleOf(def: EntityDef, data: Record<string, unknown>) {
  const v = data[def.titleKey];
  return typeof v === "string" && v.trim() ? v.trim() : `Untitled ${def.singular.toLowerCase()}`;
}

export function slugOf(def: EntityDef, data: Record<string, unknown>) {
  if (!def.slugKey) return null;
  const v = data[def.slugKey];
  return typeof v === "string" && v ? v : null;
}
