# Lalit Kumar Saini: Portfolio

Multipage portfolio built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Motion and Zod.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build && npm start
```

## Content

All content lives in typed files under `data/`. To add something, add one entry:

| To add | Edit |
|---|---|
| A project / case study | `data/projects.ts` |
| A venture | `data/ventures.ts` |
| Skills, experience, credentials, services | `data/skills.ts`, `experience.ts`, `credentials.ts`, `services.ts` |
| A nav link | `data/navigation.ts` |

Project screenshots: put images in `public/projects/` and list them in the project's `screenshots` array.
Resume: add `public/resume/Lalit-Kumar-Saini-Resume.pdf`; the download button appears automatically.

## Environment variables

Copy `.env.example` to `.env.local` for local work; set the same names in your hosting dashboard for production.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Production origin used for canonical URLs, sitemap, robots and Open Graph |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Overrides the default public contact email (footer, contact page, resume, mailto fallback) |
| `NEXT_PUBLIC_LINKEDIN_URL` | Overrides the default LinkedIn profile URL |
| `NEXT_PUBLIC_GITHUB_URL` | Overrides the default GitHub profile URL |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Contact form delivery (server-only). Without these the form reports it is not configured and offers an email link |

See `PROJECT_STATUS.md` for current status and limitations.
