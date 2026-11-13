# Lalit Kumar Saini: Portfolio

Multipage portfolio built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Zod, Drizzle ORM and Postgres.

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
| `CRON_SECRET` | Optional. Enables the scheduled-publishing cron endpoint |
| `ALLOW_LOCAL_DB`, `PGLITE_DIR`, `NEXT_DIST_DIR` | Local/testing only. Never set on a real deployment |

**Set `NEXT_PUBLIC_SITE_URL` to the real domain before deploying.** Canonical URLs, the sitemap, `robots.txt`
and structured data all derive from it. If it is unset the site falls back to Vercel's production URL, and then to
`http://localhost:3000`; `GET /api/health` reports `siteUrlConfigured: false` in that case.

See `PROJECT_STATUS.md` for current status and limitations.

## Admin CMS (branch `cms`)

Manage the portfolio at `/admin` (private, never indexed). Everything below works against the real database and is
enforced on the server (Owner and Editor roles; the proxy redirect is only a first layer).

| Area | What you can do |
|---|---|
| **Content** | Profile, Projects, Skills, Experience, Education, Certifications, Services, Ventures, Testimonials: add, edit, duplicate, save draft, publish, unpublish, archive, Trash/restore/delete forever, reorder, search. Edits to a published item stay private until you publish. |
| **Revision history** | A snapshot on every save and publish (latest 50 kept); restore any version as a draft. |
| **Scheduled publishing** | Pick a time; a draft goes live automatically (triggered by site visits, with an optional daily cron backup). |
| **Preview links** | Expiring, revocable, `noindex` links that show a draft project or venture to someone before it is published. |
| **Bulk actions** | Select several items: publish, unpublish, archive, move to Trash, restore, delete forever. Lists are paginated. |
| **Media library** | Upload PNG, JPEG, GIF, WebP or PDF (max 3 MB). The real type is checked from the file's bytes; SVG is refused. Files are stored in the database, so there is no extra service or cost. |
| **Resume** | Choose which uploaded PDF the Download Resume buttons use. |
| **SEO** | Per-page title, description, social image and `noindex`, plus site defaults. Overrides appear on the public site; `noindex` pages leave the sitemap. |
| **Redirects** | Add 301/302/307/308 redirects (loops, reserved paths and non-https external targets are refused). Changing a published project's URL creates one automatically. |
| **Messages** | Contact-form messages are saved to an inbox (read, archive, spam, notes, delete) and emailed if delivery is configured. |
| **Analytics** | Privacy-first page-view counts (no cookies, IPs or identifiers; Do Not Track respected; bots ignored). |
| **Security** | Change password; two-factor authentication (TOTP) with recovery codes. |
| **Dashboard & activity** | Real counts, health and an activity log. |

Local development uses an embedded Postgres (PGlite, `.data/`, git-ignored): no account and no cost.
Production uses Neon via `DATABASE_URL`. **Only one process may use the local database at a time**
(stop `next dev` before running the scripts below).

```bash
npm run setup:local        # generates AUTH_SECRET in .env.local, applies migrations to the local database
npm run db:seed            # imports your built-in content (data/*.ts) as published; never overwrites edits
npm run admin:create       # interactive prompt: your email + password (hidden, never stored in files)
npm run dev                # sign in at http://localhost:3000/admin/login
npm test                   # unit and integration tests (run from PowerShell/cmd on Windows, not Git Bash)
npm run admin:reset-password   # recovery; needs database access
npm run admin:reset-2fa        # recovery if you lose your authenticator and recovery codes; needs database access
```

**Upgrading an existing install** (pulling a newer version): stop `next dev`, run `npm run setup:local` (local) or
`npm run db:migrate` (hosted) to apply the new, additive migration, then `npm run db:seed` once to import the new
Services content type. Existing content is never overwritten. Until you seed, the Services page keeps showing the
built-in services.

If the database is unreachable or has never been seeded, the public site serves the built-in content from `data/`.
Without `DATABASE_URL` in production the admin shows "not configured" and the public site still works.

Hosted setup variables: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (migrations), `AUTH_SECRET` (32+ random chars).
Optional: `CRON_SECRET` (16+ chars) enables `GET /api/cron/publish-scheduled` as a daily backup trigger for scheduled
publishing. `ALLOW_LOCAL_DB=1` lets a *local* production build use the embedded database for testing. Never set it on a real deployment.

**Contact email (Resend, optional).** Create a free Resend account, verify a sending domain or use their onboarding
sender, then set `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (where notifications go) and `CONTACT_FROM_EMAIL` (a verified sender).
Without them the form still works: messages are saved to the admin inbox and the visitor is told the message was
received and saved (never "sent"). Nothing is emailed during development or tests.

**Known CMS limitations:** no autosave; previews exist for projects and ventures only; images in content are referenced by
path (copy the path from the Media library); a single owner account in normal use (the Editor role exists and is enforced,
but there is no user-management screen); password recovery is by command line (there is no email-link reset).

## Testing and quality gates

| Command | What it checks |
|---|---|
| `npm run lint` / `npx tsc --noEmit` | ESLint and TypeScript |
| `npm test` | Unit and integration tests against a real in-memory Postgres (auth, content engine, SEO helpers) |
| `npm run test:seo` | SEO and indexability audit of a running build (titles, descriptions, canonicals, Open Graph, JSON-LD, sitemap, robots, 404s, internal links) |
| `npm run test:smoke` | Quick route check: every admin and public route renders without errors (needs the throwaway database, see `tests/e2e/README.md`) |
| `npm run test:e2e` | Browser tests (Playwright + Chrome): admin auth and security, Owner/Editor permission enforcement (Server Action replay), CMS CRUD and publish flow, Ventures, public site at nine widths. See `tests/e2e/README.md` |

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
