# Lalit Kumar Saini: Portfolio

Multipage portfolio built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Zod, Drizzle ORM and Postgres.

## Requirements

Node.js 24 (see `.nvmrc`) and npm. Windows, macOS and Linux work. No account or paid service is needed for local work:
the database is an embedded Postgres (PGlite) stored in `.data/` (git-ignored).

## First run (fresh clone)

```bash
npm ci                      # exact, lockfile-based install
npm run setup:local         # creates AUTH_SECRET in .env.local and applies the database migrations
npm run db:seed             # imports the built-in content (data/*.ts) as published; never overwrites your edits
npm run admin:create        # interactive: your email and a password typed into a hidden prompt
npm run dev                 # http://localhost:3000, admin at /admin/login
```

The public site works without any of the database steps (it falls back to the built-in content in `data/`); the admin needs them.

## Everyday commands

```bash
npm run dev                 # development server
npm run check               # lint + typecheck + unit tests: run this before every commit
npm run typecheck           # next typegen && tsc --noEmit (see note below)
npm run lint
npm test                    # unit and integration tests (see "Testing")
npm run build && npm start  # production build and server
```

**Type generation.** Next.js generates the route types (`PageProps`, `LayoutProps`, `RouteContext`) into `.next/types`. On a
fresh clone a bare `npx tsc --noEmit` therefore fails until they exist. `npm run typecheck` runs `next typegen` first, so
always use it (CI does).

## Content

Day-to-day content (profile, projects, skills, experience, education, certifications, ventures, testimonials) is
managed in the **Admin CMS** (see below), with no code changes. The typed files under `data/` are the **seed and
fallback**: `npm run db:seed` imports them once, and the public site falls back to them if the database is
unavailable or has never been seeded. Services are CMS-managed too (Admin, Services). Only the site navigation
still lives in code (`data/navigation.ts`).

Images and files: upload them in Admin, Media (PNG, JPEG, GIF, WebP, PDF; max 3 MB) and copy the path into a project's
`screenshots` or other image fields. You can still commit images to `public/projects/` and reference them by path.
Resume: choose an uploaded PDF in Admin, Resume, or add `public/resume/Lalit-Kumar-Saini-Resume.pdf`; the download buttons
appear automatically.

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

## Admin CMS

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
npm run db:generate        # developers only: generate a new SQL migration after editing db/schema (review it; keep it additive)
npm run db:migrate         # apply committed migrations to the local (or, with DATABASE_URL_UNPOOLED set, hosted) database
npm run db:info            # read-only summary of the database
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
| `npm run check` | ESLint, `next typegen` + `tsc --noEmit`, and the unit tests in one go |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript (with generated route types) |
| `npm test` | Unit and integration tests against a real in-memory Postgres (auth, 2FA, `AUTH_SECRET` rotation behaviour, CSP builder, content engine, CMS features, migrations, SEO helpers). On Windows run it from PowerShell or cmd, not Git Bash |
| `npm run test:browser` | **One command for everything browser-based**: creates a throwaway database and secrets, builds, starts a production server on port 3130, runs the SEO audit and all nine browser suites, then stops the server. Options: `-- --suites=smoke,security`, `-- --skip-build`, `-- --port=3140` |
| `npm run audit:prod` | `npm audit` for production dependencies, failing on high severity or above |

Individual browser suites (they need a running throwaway test server and `BASE_URL`; `npm run test:browser` handles that for you):

| Command | What it checks |
|---|---|
| `npm run test:seo` | SEO and indexability audit of a running build (titles, descriptions, canonicals, Open Graph, JSON-LD, sitemap, robots, 404s, internal links) |
| `npm run test:a11y` | WCAG 2.2 AA audit with axe-core: every public page at 375 and 1440 px, the open mobile menu, and the admin screens in both themes |
| `npm run test:security` | Attack scenarios: anonymous access, owner-only action replay, stored XSS (incl. a JSON-LD breakout), SQL injection, path traversal, malformed requests, unsafe uploads, headers |
| `npm run test:smoke` | Quick route check: every admin and public route renders without errors |
| `npm run test:features` | Media, resume, SEO overrides, redirects, inbox, revisions, preview links, bulk actions, scheduled publishing and two-factor sign-in (takes a few minutes) |
| `npm run test:e2e` | Browser tests (Playwright + Chrome): admin auth and security, Owner/Editor permission enforcement (Server Action replay), CMS CRUD and publish flow, Ventures, public site at nine widths. See `tests/e2e/README.md` |

**Continuous integration.** `.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: a *quality* job
(`npm ci`, hygiene check, lint, typecheck, unit tests, production dependency audit, build with no database and no secrets) and a
*browser* job (`npm run test:browser` on the runner's Chrome). It has permissions `contents: read` and **no deployment job**.

The browser tests run only against a throwaway database created by `npm run e2e:setup`, which refuses to touch
your real local database or any hosted database. They also refuse to run unless `BASE_URL` is set explicitly, so they can
never be pointed at your everyday dev server by accident.

## Deploying

Deployment is a separate, manual decision and has not been performed. The complete production guide (Neon, Vercel,
environment variables, migrations, email, cron, domain and TLS, backup, rollback and a post-deploy checklist) is in
**`docs/deployment.md`**. Security procedures (CSP, `AUTH_SECRET` rotation, recovery) are in `docs/security.md`.

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

## Looking inside the database

There is no database studio (`npm run db:studio` does not exist, and none is needed). `npm run db:info` prints which database it
targets, the applied migrations and a row count per table plus content by type and status. It only runs `SELECT`s. For the local
database stop `next dev` first (the embedded database allows one process at a time).

## Architecture in one minute

- `app/(site)` is the public site (server components, content from the database through a tagged cache, falling back to `data/`).
  `app/admin` is the private CMS (every page and action calls `requireAdmin(permission)`). `proxy.ts` handles admin redirects,
  CMS redirects, real 404s for unknown project slugs and invalid preview links.
- `lib/content` is the content engine (schemas, registry, service, revisions, scheduling, preview, bulk, public reads);
  `lib/auth` is authentication (argon2id, hashed sessions, throttling, TOTP); `lib/media`, `lib/messages`, `lib/redirects`,
  `lib/settings`, `lib/analytics` are the other CMS modules. `lib/csp.ts` builds the Content-Security-Policy sent from
  `next.config.ts`. `db/` holds the Drizzle schema and additive SQL migrations. `scripts/` holds the CLI tools
  (setup, migrate, seed, admin accounts, `run-e2e.mjs`).

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing script: db:studio` | It does not exist. Use `npm run db:info`. |
| A script or test cannot open the local database | Only one process can use `.data/pglite`. Stop `next dev` (and any test server) first. |
| `npm run admin:create` says the tables are missing | Run `npm run setup:local` first. After pulling new code, run it again to apply new migrations, then `npm run db:seed`. |
| Port 3000 is busy | Another dev server is running. Use `npm run dev -- -p 3001`, or stop the other one. |
| The site shows old content after an edit | Published content is cached for about a minute; admin saves refresh it immediately. Hard-refresh once. |
| Tests say `BASE_URL is not set` | Intended: start the throwaway test server (see `tests/e2e/README.md`) and set `BASE_URL` to it. |
| Locked out of the admin | `npm run admin:reset-password` (and `npm run admin:reset-2fa` if you lost your authenticator and recovery codes). |
| `next dev` / `next build` edits `AGENTS.md` or `tsconfig.json` | Normal framework behaviour (it rewrites formatting and adds its output folders); review the diff and commit or discard it. |
| `tsc` reports missing `PageProps` / `LayoutProps` / `RouteContext` | The generated route types do not exist yet. Use `npm run typecheck` (it runs `next typegen` first). |
| Two-factor codes stop working after `AUTH_SECRET` changed | Expected: the secret encrypts the 2FA data. Follow the rotation procedure in `docs/security.md` (`npm run admin:reset-2fa`, then set 2FA up again). |
| `npm run test:browser` says `DATABASE_URL` is set | Intended: it refuses to run beside a hosted database. Unset it in that terminal. |

More: `docs/deployment.md`, `docs/security.md`, `docs/seo-strategy.md`, `docs/cms-architecture.md` (historical planning document), `PROJECT_STATUS.md`.
