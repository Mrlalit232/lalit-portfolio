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

Day-to-day content (profile, projects, skills, experience, education, certifications, ventures, testimonials) is
managed in the **Admin CMS** (see below), with no code changes. The typed files under `data/` are the **seed and
fallback**: `npm run db:seed` imports them once, and the public site falls back to them if the database is
unavailable or has never been seeded. Services and the navigation still live in code (`data/services.ts`,
`data/navigation.ts`).

Project screenshots: put images in `public/projects/` and list them in the project's `screenshots` array.
There is no upload feature: images are referenced by URL or committed to `public/`.
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
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET` | Hosted database and admin sessions (see Admin CMS). Required for the admin in production |
| `ALLOW_LOCAL_DB`, `PGLITE_DIR`, `NEXT_DIST_DIR` | Local/testing only. Never set on a real deployment |

**Set `NEXT_PUBLIC_SITE_URL` to the real domain before deploying.** Canonical URLs, the sitemap, `robots.txt`
and structured data all derive from it. If it is unset the site falls back to Vercel's production URL, and then to
`http://localhost:3000`; `GET /api/health` reports `siteUrlConfigured: false` in that case.

See `PROJECT_STATUS.md` for current status and limitations.

## Admin CMS (branch `cms`)

Manage the portfolio at `/admin` (private, never indexed): Profile, Projects, Skills, Experience, Education,
Certifications, Ventures and Testimonials, each with Add / Edit / Duplicate / Archive / Delete (Trash + restore),
Save draft, Publish, Unpublish, reorder, search and an activity log. Edits to a published item stay private
until you publish. The public site shows only published content.

Local development uses an embedded Postgres (PGlite, `.data/`, git-ignored): no account and no cost.
Production uses Neon via `DATABASE_URL`. **Only one process may use the local database at a time**
(stop `next dev` before running the scripts below).

```bash
npm run setup:local        # generates AUTH_SECRET in .env.local, applies migrations to the local database
npm run db:seed            # imports your existing content (data/*.ts) as published; never overwrites edits
npm run admin:create       # interactive prompt: your email + password (hidden, never stored in files)
npm run dev                # sign in at http://localhost:3000/admin/login
npm test                   # unit tests (run from PowerShell/cmd on Windows, not Git Bash)
npm run admin:reset-password   # recovery; needs database access
```

If the database is unreachable or has never been seeded, the public site serves the built-in content from `data/`.
Without `DATABASE_URL` in production the admin shows "not configured" and the public site still works.

Hosted setup variables: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (migrations), `AUTH_SECRET` (32+ random chars).
Apply migrations with `npm run db:migrate`, then `npm run db:seed`.
`ALLOW_LOCAL_DB=1` lets a *local* production build use the embedded database for testing. Never set it on a real deployment.

## Testing and quality gates

| Command | What it checks |
|---|---|
| `npm run lint` / `npx tsc --noEmit` | ESLint and TypeScript |
| `npm test` | Unit and integration tests against a real in-memory Postgres (auth, content engine, SEO helpers) |
| `npm run test:seo` | SEO and indexability audit of a running build (titles, descriptions, canonicals, Open Graph, JSON-LD, sitemap, robots, 404s, internal links) |
| `npm run test:e2e` | Browser tests (Playwright + Chrome): admin auth, CMS CRUD and publish flow, Ventures, public site at nine widths. See `tests/e2e/README.md` |

The browser tests run only against a throwaway database created by `npm run e2e:setup`, which refuses to touch
your real local database or any hosted database.

## Production build and start

```bash
npm run build
npm start                  # serves on port 3000 (PORT=... to change)
```

`GET /api/health` is a liveness/readiness probe: `200` when the site is serving, `503` only if a configured
database is unreachable. It exposes no secrets. The site stays up on built-in content if the database is down.

## Backup and recovery

Content lives in the database, so back that up, not the code. On Neon use point-in-time restore/branching;
before risky changes create a Neon branch. For the local database, copy the `.data/pglite` folder while no
process is using it. The activity log and Trash (soft delete) cover accidental edits; `npm run db:seed` never
overwrites existing content. Secrets live only in `.env.local` (git-ignored) or the hosting dashboard.

More: `docs/cms-architecture.md`, `docs/seo-strategy.md`, `docs/security.md`.
