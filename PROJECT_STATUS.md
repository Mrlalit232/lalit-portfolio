# Project Status: Lalit Kumar Saini Portfolio

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Zod · Drizzle · Postgres (Neon in production, embedded PGlite locally)

## State: development complete on branch `cms`; NOT deployed, NOT merged to `main`, final product testing NOT yet done

Deployment and the final product-testing phase are deliberately reserved for later. This document records what exists and what has actually been checked.

Routes: `/` · `/about` · `/experience` · `/projects` · `/projects/[slug]` · `/skills` · `/services` · `/ventures` · `/resume` · `/contact` · `/preview/[token]` (private) · `/media/[id]` · `/sitemap.xml` · `/robots.txt` · `/api/health` · private `/admin/*`.

## What the CMS now covers
Content (Profile, Projects, Skills, Experience, Education, Certifications, **Services**, Ventures, Testimonials) with drafts, publish, unpublish, archive, Trash, duplicate, reorder, **bulk actions and pagination**; **revision history with restore**; **scheduled publishing**; **expiring preview links**; **media library** (images and PDFs, stored in Postgres); **resume manager**; **SEO manager** (per-page title, description, social image, noindex); **redirect manager** (plus automatic redirects when a published project URL changes); **contact-message inbox**; **privacy-first analytics**; **TOTP two-factor authentication with recovery codes**; change password; dashboard with real counts; activity log. Details in `README.md`.

## Development checks run for this change (all local)
- ESLint clean · `tsc --noEmit` clean · local production build succeeds (default environment, no database configured).
- 76 unit/integration tests passing against a real in-memory Postgres: authentication, content engine, SEO helpers, **revisions, scheduling, preview links, bulk actions, redirects, SEO settings, media validation, inbox, analytics, TOTP (verified against the RFC 6238 test vectors), 2FA enrolment/sign-in/recovery/lockout, password change**, and a **migration upgrade test** (a database with data at the previous schema is upgraded; existing users, content and sessions survive; the migration contains no destructive statements).
- Route smoke check `npm run test:smoke`: 37/37 (every admin and public route renders, no console errors).
- Feature check `tests/e2e/features.mjs`: 38/38 on a throwaway database (media, resume, SEO overrides, redirects, inbox, revisions, preview links, bulk actions, scheduled publishing, two-factor sign-in with recovery codes). This was a development check of new code, **not** final product testing.
- `npm audit --omit=dev`: 0 vulnerabilities.

## NOT run in this change (reserved for the later testing phase)
- The existing browser suites `tests/e2e/admin|permissions|cms|ventures|public.mjs` and `npm run test:seo` were **not re-run** after these changes. A few of their expectations were updated by reading (new Services count, media library line on the dashboard, contact success wording), so expect to confirm them first thing in the testing phase.
- Lighthouse and responsive measurements were not repeated (the previous results predate the CMS additions).
- No manual product QA, no cross-browser testing, no real email delivery, no hosted (Neon/Vercel) run, no production smoke test.

## Owner actions
- Production: create a free Neon database; set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` (the final domain); run `npm run db:migrate`, `db:seed`, `admin:create`; turn on two-factor in Admin, Security.
- **Upgrading your existing local database:** stop `next dev`, run `npm run setup:local` (applies the additive migration `0002`), then `npm run db:seed` once to import Services. Nothing existing is overwritten.
- Optional: Resend keys (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`); `CRON_SECRET` plus a daily cron for scheduled publishing on a site with few visitors.
- After launch: Search Console and Bing verification (instructions in `docs/seo-strategy.md`); resume PDF upload in Admin, Resume.
- Decide whether to remediate the old email in public Git history (procedure in `docs/security.md`; destructive, needs approval).

## Known limitations
- No autosave; previews only for projects and ventures; no pages/navigation managers, no JSON export, no user-management screen (Editor role is enforced and tested but accounts are created in code/CLI), no emailed password-reset link (recovery is by command line, deliberately).
- Media bytes are stored in Postgres (3 MB per file cap): fine for a portfolio, watch the free-tier quota. Resend/email, hosted-database behaviour and Vercel behaviour are untested.
- Contact-form and analytics rate limiting are in memory (best effort on serverless). Scheduled publishing is triggered by visits and an optional cron, so a time can pass by minutes on a quiet site (never lost).
- `npm audit` (all): 11 moderate advisories, all in development tooling (drizzle-kit's bundled esbuild; typescript-eslint's minimatch). No compatible fix exists (the latest releases carry them; the offered fix is a breaking downgrade), so none were applied.
- Scroll reveals use `animation-timeline: view()`: browsers without support show the content without the slide effect.
- The old email remains in public Git history on `main`.
