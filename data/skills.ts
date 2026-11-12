import type { SkillGroup } from "./types";

export const skillGroups: SkillGroup[] = [
  {
    id: "web",
    title: "Web Development",
    blurb: "Front-end foundations and the frameworks I have used in projects.",
    accent: "tech",
    skills: [
      { name: "HTML", level: "Applied in projects" },
      { name: "CSS", level: "Applied in projects" },
      { name: "JavaScript", level: "Applied in projects" },
      { name: "React", level: "Applied in projects" },
      { name: "Next.js", level: "Applied in projects" },
      { name: "Vite", level: "Applied in projects" },
    ],
  },
  {
    id: "qa",
    title: "QA & Test Automation",
    blurb: "Testing practice built through study and hands-on exercises.",
    accent: "tech",
    skills: [
      { name: "Software Testing Fundamentals", level: "Working knowledge" },
      { name: "Manual Testing", level: "Working knowledge" },
      { name: "Functional Testing", level: "Working knowledge" },
      { name: "Non-functional Testing", level: "Working knowledge" },
      { name: "SDLC", level: "Working knowledge" },
      { name: "STLC", level: "Working knowledge" },
      { name: "Bug Reporting", level: "Working knowledge" },
      { name: "Test Case Design", level: "Working knowledge" },
      { name: "Jira", level: "Working knowledge" },
      { name: "Python", level: "Learning & practising" },
      { name: "Test Automation", level: "Learning & practising" },
    ],
  },
  {
    id: "business",
    title: "Business & Operations",
    blurb: "Skills used in real work at Red Hills Group.",
    accent: "business",
    skills: [
      { name: "Client Communication", level: "Applied in work" },
      { name: "Customer Handling", level: "Applied in work" },
      { name: "Lead Generation", level: "Applied in work" },
      { name: "Sales Support", level: "Applied in work" },
      { name: "Operations Coordination", level: "Applied in work" },
      { name: "Team Coordination", level: "Applied in work" },
      { name: "Project Coordination", level: "Working knowledge" },
    ],
  },
  {
    id: "digital",
    title: "Digital & Productivity",
    blurb: "Tools for marketing, reporting and everyday efficiency.",
    accent: "creative",
    skills: [
      { name: "Digital Marketing", level: "Applied in work" },
      { name: "Advanced Excel", level: "Working knowledge" },
      { name: "Dashboards", level: "Working knowledge" },
      { name: "Pivot Tables", level: "Working knowledge" },
      { name: "Lookups", level: "Working knowledge" },
      { name: "AI Tools", level: "Applied in projects" },
    ],
  },
];

export const proficiencyNote =
  "Labels describe how I have used each skill. They are not a claim of expert-level proficiency.";
