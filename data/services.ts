import type { Service } from "./types";

export const services: Service[] = [
  {
    id: "website-development",
    title: "Website Development",
    summary: "Responsive, fast websites built with modern tooling such as React and Next.js.",
    includes: ["Page structure and layout", "Responsive build", "Basic SEO setup", "Deployment support"],
    idealFor: "Individuals and small teams that need a dependable web presence.",
  },
  {
    id: "business-websites",
    title: "Business Websites",
    summary: "Clear, credible sites that explain what a business does and make it easy to get in touch.",
    includes: ["Service and about pages", "Contact and inquiry forms", "Mobile-first layout", "Search-friendly structure"],
    idealFor: "Local businesses and startups establishing their online presence.",
  },
  {
    id: "portfolio-websites",
    title: "Portfolio Websites",
    summary: "Personal sites that present work, experience and skills with clarity.",
    includes: ["Project showcase", "Resume page", "Contact flow", "Content that is easy to update"],
    idealFor: "Students, freelancers and professionals building a personal brand.",
  },
  {
    id: "landing-pages",
    title: "Landing Pages",
    summary: "Focused single-purpose pages for a campaign, launch or offer.",
    includes: ["Message and layout structure", "Lead or inquiry capture", "Responsive design", "Performance-minded build"],
    idealFor: "Campaigns that need one clear action.",
  },
  {
    id: "website-maintenance",
    title: "Website Maintenance",
    summary: "Ongoing updates and fixes so an existing site stays current and working.",
    includes: ["Content updates", "Bug fixes", "Basic testing of key flows", "Small improvements"],
    idealFor: "Sites that need a reliable person to keep them in shape.",
  },
  {
    id: "digital-marketing-support",
    title: "Digital Marketing Support",
    summary: "Support with online marketing activity, drawing on my experience in lead generation and follow-up.",
    includes: ["Campaign support", "Lead tracking in Excel", "Follow-up coordination", "Simple reporting"],
    idealFor: "Small teams that need extra hands on marketing operations.",
  },
  {
    id: "digital-presence",
    title: "Business Digital Presence",
    summary: "Helping a business get its basics online and organised: website, contact flow and tracking.",
    includes: ["Website and inquiry flow", "Lead tracking set-up", "Light reporting dashboards"],
    idealFor: "Owners moving a business onto digital channels for the first time.",
  },
];

export const serviceProcess = [
  { step: "01", title: "Discuss", body: "We talk through your goals, audience and timeline." },
  { step: "02", title: "Plan", body: "I outline the pages, features and approach before building." },
  { step: "03", title: "Build", body: "I develop in clear stages and check progress with you." },
  { step: "04", title: "Test & launch", body: "I test the key flows, fix issues and help with deployment." },
];
