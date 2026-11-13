export type NavItem = { label: string; href: string };

export type ProjectCategory = "AI & Software" | "Web Platforms" | "Personal Brand";

export type ProjectLink = { label: string; href: string };

export type Project = {
  slug: string;
  title: string;
  category: ProjectCategory;
  tagline: string;
  summary: string;
  status: string;
  featured: boolean;
  stack: string[];
  links: ProjectLink[];
  caseStudy: {
    overview: string[];
    objective: string[];
    solution: string[];
    role: string[];
    implementation: string[];
    /** Only challenges the author actually reported. Omit when none are verified. */
    challenges?: string[];
    /** Features that exist today. */
    implemented: string[];
    /** Honest list of what is planned but not built. */
    planned: string[];
    future: string[];
  };
  /** Real screenshots. Leave empty until images are added to /public/projects. */
  screenshots: { src: string; alt: string }[];
  /** Architecture flow shown as a visual demonstration. */
  architecture?: { label: string; detail: string }[];
};

export type Experience = {
  company: string;
  role: string;
  period: string;
  duration: string;
  summary: string;
  responsibilities: string[];
  transferable: string[];
};

export type SkillLevel =
  | "Working knowledge"
  | "Learning & practising"
  | "Applied in projects"
  | "Applied in work";

export type SkillGroup = {
  id: string;
  title: string;
  blurb: string;
  accent: "tech" | "business" | "creative";
  skills: { name: string; level: SkillLevel }[];
};

export type Credential = {
  title: string;
  issuer: string;
  kind: "Education" | "Certification" | "Participation" | "Activity";
  note?: string;
};

export type Service = {
  id: string;
  title: string;
  summary: string;
  includes: string[];
  idealFor: string;
};

export type VentureStage = "active" | "concept";

export type Venture = {
  id: string;
  name: string;
  /** Exact status label shown to visitors. */
  status: string;
  /** "active" = work in progress; "concept" = idea or planning, not operating. */
  stage: VentureStage;
  tagline: string;
  summary: string;
  /** Heading for the list below, e.g. "Services" or "Proposed features". */
  listTitle: string;
  items: string[];
  /** Optional second list, e.g. the proposed business model. */
  secondaryTitle?: string;
  secondaryItems?: string[];
  /** Honest framing note shown on the card. */
  note: string;
  link?: { label: string; href: string };
};
