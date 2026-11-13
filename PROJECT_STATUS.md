# Project Status: Lalit Kumar Saini Portfolio

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Zod · Drizzle · Postgres (Neon in production, embedded PGlite locally)

## State: code complete and verified locally; NOT deployed, NOT merged to `main`

Branch `feature/elite-portfolio-quality-upgrade` (working tree ready for a manual commit and push; nothing was committed, pushed, merged or deployed by the last verification pass). Deployment is a separate, later step.

Routes: `/` · `/about` · `/experience` · `/projects` · `/projects/[slug]` · `/skills` · `/services` · `/ventures` · `/resume` · `/contact` · `/preview/[token]` (private) · `/media/[id]` · `/sitemap.xml` · `/robots.txt` · `/api/health` · private `/admin/*`.

## What exists
Public portfolio plus an admin CMS: content (Profile, Projects, Skills, Experience, Education, Certifications, Services, Ventures, Testimonials) with drafts, publish, unpublish, archive, Trash, duplicate, reorder, bulk actions and pagination; revision history with restore; scheduled publishing; expiring preview links; media library (images and PDFs, stored in Postgres); resume manager; SEO manager; redirect manager (automatic redirects when a published project URL changes); contact-message inbox; privacy-first analytics; TOTP two-factor authentication with recovery codes; change password; dashboard with real counts; activity log. Details in `README.md`.

## Verified (final code, clean build, fresh throwaway database)
- Browser suites (Playwright + Chrome, `BASE_URL` set explicitly to the throwaway server): public site at nine widths **497/497** · admin 18/18 · permissions 19/19 · CMS 87/87 · Ventures 29/29 · accessibility (axe-core, WCAG 2.2 AA, public pages, mobile menu, admin in both themes) 55/55 · security 59/59 · new-module feature check 38/38 · smoke 37/37 · SEO audit 200/200.
- ESLint clean · `tsc --noEmit` clean · 83 unit/integration tests passing (includes a migration-upgrade test and a file-backed database persistence/restart test) · production build succeeds in the default environment · `npm audit --omit=dev`: 0 vulnerabilities.

## Lighthouse (lab, local production build, medians; individual runs vary by several points on this machine)
| Page | Mobile performance | Mobile TBT | Desktop performance | CLS |
|---|---|---|---|---|
| Home | **91** (7 runs: 92, 84, 92, 93, 91, 83, 84) | 147 ms | 99 | 0 |
| About | 95 | 135 ms | 100 | 0 |
| Case study | 91.5 (6 runs) | 163 ms | 100 (6 runs) | 0 in all 12 runs |
| Skills | 92 | 154 ms | 100 | 0 |

Accessibility, best practices and SEO are 100 on every measured page. Mobile LCP under Lighthouse's slow-device simulation is still about 2.9-3.4 s (above the 2.5 s "good" mark); in a real, unthrottled mobile Chrome home paints at about 0.7 s. INP cannot be measured in a lab run. The 90+ mobile target is met by the median on home but not by every single run.

## Fixes made in the last verification passes
- Case-study layout shift (footer, CLS up to 0.4 in some runs): the streaming placeholder is now taller than the viewport, so the footer cannot visibly jump. Verified: 0 shift in 12 runs.
- Home performance: the contact form's constants and the Zod schema lived in one module, so the whole Zod library shipped to the browser (and the home page prefetched it). They are now split (`lib/contact-shared.ts`); client JavaScript contains no Zod. Home mobile median went from 85-88 to 91.
- Earlier in this round: NUL characters (which Postgres cannot store) no longer cause server errors from search, forms or the contact form; the `X-Powered-By` header is removed; admin light-theme contrast; the Next.js dev-only ESLint scan of build folders.

## Known limitations (read these)
- **`/nope` 404 check, documented known limitation (test infrastructure, NOT a verified application bug, NOT a verified fix).** It failed intermittently twice (React hydration error #418 on the 404 page at 320/375 px, and one network-idle timeout) only on runs that reused an old build folder after deleting just its cache. It could not be reproduced on any clean build (497/497 every time, 0/580 in a stress run) and the root cause was not proven. The test is unchanged and still runs. Details and the correct procedure for trustworthy runs: `tests/e2e/README.md`.
- Not built: autosave; pages/navigation managers; JSON export; user-management screen (Editor role is enforced and tested but accounts come from code/CLI); emailed password-reset links (recovery is by command line, deliberately).
- Media bytes are stored in Postgres (3 MB per file cap): fine for a portfolio, watch the free-tier quota. Contact-form and analytics rate limiting are in memory (best effort on serverless). Scheduled publishing is triggered by visits and an optional cron.
- `npm audit` (all): 11 moderate advisories, all in development tooling (drizzle-kit's bundled esbuild; typescript-eslint's minimatch). No compatible fix exists (the offered fix is a breaking downgrade), so none was applied.
- Not tested: a hosted Neon/Vercel deployment, real email delivery, Search Console. The server log of a production build shows a harmless-looking `MaxListenersExceededWarning` (11 close listeners on a response) that was not investigated.
- Scroll reveals use `animation-timeline: view()`: browsers without support show the content without the slide effect.
- The old email remains in public Git history on `main` (remediation procedure in `docs/security.md`, needs your approval).
- Profile text in `data/profile.ts` (QA-first order and intro) only applies to new installs and the fallback; your existing database content is edited in Admin, Profile.

## Owner actions
- Production: Neon database; `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`; run `npm run db:migrate`, `db:seed`, `admin:create`; enable two-factor in Admin, Security. Optional: Resend keys, `CRON_SECRET`.
- Upgrading your local database: stop `next dev`, `npm run setup:local`, then `npm run db:seed` (imports Services; never overwrites your edits).
- After launch: Search Console and Bing verification (`docs/seo-strategy.md`); upload the resume PDF in Admin, Resume.
