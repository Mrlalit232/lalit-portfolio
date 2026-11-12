import type { Project, ProjectCategory } from "./types";

/**
 * Add a new project by appending an object here. The listing page, filters,
 * case-study route, sitemap and homepage featured section all read from this
 * array, so no other file needs to change.
 */
export const projects: Project[] = [
  {
    slug: "geniq",
    title: "GenIQ",
    category: "AI & Software",
    tagline: "A self-hosted, air-gapped AI workbench for confidential documents.",
    summary:
      "A local-first AI workbench concept for confidential organisational documents, built around Smart India Hackathon problem statement SIH26117 and aimed at government, PSU and defence-style environments.",
    status: "Hackathon project (SIH26117)",
    featured: true,
    stack: ["React", "Vite", "FastAPI", "Python", "Ollama", "Llama 3.2:3b", "pypdf"],
    links: [],
    caseStudy: {
      overview: [
        "GenIQ is a self-hosted AI workbench designed so that confidential documents never have to leave the organisation's own machines. Instead of calling a cloud AI service, it runs a language model locally and lets a user work with their documents through a chat interface.",
        "It was built for Smart India Hackathon problem statement SIH26117.",
      ],
      objective: [
        "Organisations that handle sensitive material, such as government, PSU and defence-related bodies, often cannot send documents to external AI services.",
        "The objective was to show that useful document-aware AI assistance can run entirely on local infrastructure, in an air-gapped style deployment.",
      ],
      solution: [
        "A React and Vite front end lets a user upload documents and chat with an assistant. A FastAPI backend written in Python handles uploads, extracts text from PDFs using pypdf, and sends prompts to a locally running Ollama server hosting the Llama 3.2:3b model.",
        "Because every component runs locally, no document content needs to reach an external service.",
      ],
      role: [
        "Team Leader & Project Developer. This was a team project. I contributed to development activities involving React/Vite, FastAPI, Ollama integration and PDF processing.",
      ],
      implementation: [
        "Front end: a React + Vite interface for document upload and an AI chat experience.",
        "Backend: a FastAPI service exposing endpoints that the interface calls.",
        "Document processing: PDF text extraction with pypdf so document content can be used as context.",
        "Local AI: integration with Ollama running Llama 3.2:3b, so inference happens on the local machine.",
      ],
      implemented: [
        "Local AI model integration (Ollama, Llama 3.2:3b)",
        "Document upload",
        "PDF processing with pypdf",
        "AI chat interface",
        "Backend API integration between the interface and the model",
        "Local-deployment-oriented architecture",
      ],
      planned: [
        "Formal security review and hardening. GenIQ is not claimed to be production-grade or enterprise-secure.",
        "Measured performance evaluation. No benchmark results are claimed.",
      ],
      future: [
        "Support for more document formats beyond PDF",
        "Better retrieval over long documents",
        "Access control and audit logging",
        "Systematic testing and performance measurement",
      ],
    },
    screenshots: [],
    architecture: [
      { label: "React + Vite UI", detail: "Upload and chat interface" },
      { label: "FastAPI backend", detail: "Python API layer" },
      { label: "pypdf", detail: "PDF text extraction" },
      { label: "Ollama", detail: "Local model runtime" },
      { label: "Llama 3.2:3b", detail: "On-device language model" },
    ],
  },
  {
    slug: "bhim-coaching-center",
    title: "BHIM Coaching Center",
    category: "Web Platforms",
    tagline: "A digital learning platform concept for a coaching centre.",
    summary:
      "An educational platform project for a coaching centre, with a notes and NCERT library, lectures, courses, community and student-support areas. Live as a front-end demo.",
    status: "Live front-end demo",
    featured: true,
    stack: ["React", "Vite", "Vercel"],
    links: [
      { label: "Live demo", href: "https://bhim-coaching-app.vercel.app/" },
      { label: "GitHub repository", href: "https://github.com/Mrlalit232/bhim-coaching-app" },
    ],
    caseStudy: {
      overview: [
        "BHIM Coaching Center is a digital platform concept that brings the main parts of a coaching centre's offering into one web application: study material, lectures, courses, a student community and support.",
      ],
      objective: [
        "Give students a single place to find notes, NCERT material, lectures and courses, and to ask for help when they are stuck.",
      ],
      solution: [
        "A React and Vite single-page application organised into sections for the notes and NCERT library, lectures, courses, community, and student support including doubt-related functionality. It is deployed on Vercel.",
      ],
      role: ["Frontend Developer. I developed the React/Vite frontend application."],
      implementation: [
        "Component-based React interface built with Vite.",
        "Separate sections for notes and NCERT library, lectures, courses, community and student support.",
        "Deployed to Vercel as a live demo.",
      ],
      implemented: [
        "Notes and NCERT library section",
        "Lectures section",
        "Courses section",
        "Community section",
        "Student support and doubt-related section",
        "Live deployment on Vercel",
      ],
      planned: [
        "A backend and database. The current build is a front-end demo, so user accounts, persistent data and real doubt submission are planned rather than built.",
      ],
      future: [
        "Backend API and database for user accounts and content management",
        "Authentication for students and teachers",
        "Real doubt submission and responses",
        "Progress tracking for courses",
      ],
    },
    screenshots: [],
  },
  {
    slug: "personal-portfolio",
    title: "Personal Portfolio",
    category: "Personal Brand",
    tagline: "This site: a multipage Next.js portfolio built as a content-driven system.",
    summary:
      "The portfolio you are viewing: a multipage Next.js application with a typed content layer, a reusable design system, SEO metadata and a validated contact flow.",
    status: "Current project",
    featured: true,
    stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Motion", "Zod"],
    links: [],
    caseStudy: {
      overview: [
        "This portfolio presents my technical work, professional experience and services in one place, for recruiters, hiring managers and potential clients.",
      ],
      objective: [
        "Create a portfolio that is honest about my experience, easy to maintain, and works for both employment and business enquiries without mixing the two.",
      ],
      solution: [
        "A multipage Next.js App Router application. Content lives in typed data files, pages are composed from reusable components, and the contact form validates on the server with Zod.",
      ],
      role: ["Designed and built the whole project."],
      implementation: [
        "Architecture: App Router with server components by default. Client components are used only for navigation, animation and the contact form.",
        "Content: profile, projects, skills, experience, services and credentials are centralised in typed data files, so a new project is a single new entry.",
        "Design system: dark-first design tokens, a shared type scale and reusable surface, button, badge and section components.",
        "SEO: page-level metadata, a generated sitemap and robots file, canonical URLs and structured data, with the production domain set through an environment variable.",
        "Accessibility: semantic landmarks, keyboard-operable navigation, visible focus states, labelled form fields and reduced-motion support.",
        "Responsive: mobile-first layouts checked from phone to large desktop widths.",
      ],
      implemented: [
        "Multipage routing with a dynamic case-study route",
        "Centralised typed content",
        "Project filters by category",
        "Responsive navigation with a keyboard-accessible mobile menu",
        "Server Action contact form with Zod validation, honeypot and rate limiting",
        "Sitemap, robots and metadata",
      ],
      planned: [
        "Email delivery depends on configuring a provider. Until then the form directs people to an email link.",
        "Real screenshots for project pages are added as they are captured.",
      ],
      future: [
        "Project screenshots and short demo clips",
        "Optional writing section for testing and learning notes",
        "Automated end-to-end tests for the main flows",
      ],
    },
    screenshots: [],
  },
];

export const projectCategories: ("All" | ProjectCategory)[] = [
  "All",
  ...Array.from(new Set(projects.map((p) => p.category))),
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
export const featuredProjects = projects.filter((p) => p.featured);
