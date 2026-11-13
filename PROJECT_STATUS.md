# Project Status: Lalit Kumar Saini Portfolio

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Zod · Drizzle · Postgres (Neon in production, embedded PGlite locally)

## State: release-ready code on branch `cms`; NOT deployed, NOT merged to `main`

Deployment, domain, hosted database and Search Console are deliberately pending and need the owner (see "Owner actions").

Routes: `/` · `/about` · `/experience` · `/projects` · `/projects/[slug]` · `/skills` · `/services` · `/ventures` · `/resume` · `/contact` · `/sitemap.xml` · `/robots.txt` · `/api/health` · private `/admin/*`.

## Content
Managed in the Admin CMS (database). `data/*.ts` is the seed and the fallback used if the database is unavailable or unseeded. Services and navigation remain in code. Site-wide settings and contact links are in `lib/site.ts`.

## Verified (final run, production build, fresh throwaway database)
- ESLint clean · `tsc --noEmit` clean · production build succeeds (default environment, no database configured).
- 42 unit/integration tests passing (auth, content engine, SEO helpers).
- Browser suites (Playwright + Chrome): admin auth/security 18/18 · **Owner/Editor/anonymous permissions 19/19** · CMS 86/86 · Ventures 29/29 · public site 497/497 across nine widths (320-1920 px).
- SEO audit `npm run test:seo`: 200/200 (unique titles/descriptions, canonicals, Open Graph, JSON-LD, sitemap, robots, breadcrumbs, internal links, real 404s, noindex admin).
- Database failure modes (production build): no database configured and configured-but-unreachable both keep every public page serving built-in content; `/api/health` reports `not-configured` (200) or `unreachable` (503); no error details leak.
- `npm audit --omit=dev`: 0 vulnerabilities. `npm audit` (all): 11 moderate, all in development tooling (see Known limitations).

## Lighthouse (lab, local production build, 5 runs per page, default mobile and desktop profiles)
| Page | Mobile performance (runs) | Median | Mobile LCP median | Mobile TBT median | A11y / Best practices / SEO |
|---|---|---|---|---|---|
| `/` | 90, 87, 89, 86, 90 | **89** | 3.39 s | 184 ms | 100 / 100 / 100 |
| `/about` | 97, 97, 91, 97, 97 | **97** | 2.63 s | 49 ms | 100 / 100 / 100 |
| `/skills` | 94, 96, 95, 96, 95 | **95** | 2.88 s | 59 ms | 100 / 100 / 100 |
| `/projects/geniq` | 88, 96, 96, 96, 96 | **96** | 2.77 s | 47 ms | 100 / 100 / 100 |

Desktop: performance 99-100 on all four, LCP 0.6-0.85 s. CLS 0 everywhere. Before this work mobile performance was roughly 69-93 (case study 69-83, SEO 91). INP cannot be measured in a lab run.
Honest caveat: mobile LCP under Lighthouse's simulated slow-4G/4x-CPU profile is still 2.6-3.4 s (above the 2.5 s "good" mark), and `/` is 1 point under 90. In a real mobile-emulated Chrome with no throttling, home paints at FCP 0.52 s / LCP 0.72 s. The remaining cost is the React/Next runtime itself, which cannot be removed.

## Changes in this release
- **Performance**: the animation library was removed; transitions, hero entrance and scroll reveals are CSS-only (no content waits for JavaScript); `content-visibility: auto` on off-screen sections. Total blocking time on mobile dropped from 120-420 ms to 47-184 ms (medians).
- **SEO**: case studies are prerendered (`generateStaticParams`), so their metadata is in `<head>` for every client (the earlier streaming-metadata problem is resolved without `htmlLimitedBots`, which breaks link prefetching); richer JSON-LD; breadcrumbs; `og:image` on every page; keyword-aware titles; internal links.
- **Accessibility**: header link name matches its visible text; reveal animation no longer changes opacity (always contrast-compliant). Lighthouse accessibility 100 on all measured pages.
- **Security**: Permissions-Policy and HSTS headers; Owner vs Editor vs anonymous permissions proven by replaying captured Server Action requests (with an Owner control); `createAdminUser` accepts a role (used for the Editor test account).
- **QA tooling in the repo**: `tests/e2e/*`, `scripts/seo-audit.mjs`, `scripts/e2e-setup.ts` (refuses real and hosted databases).
- **Docs** aligned: README, `.env.example`, `docs/cms-architecture.md` (status banner), `docs/seo-strategy.md`, `docs/security.md`, `tests/e2e/README.md`.

## Owner actions (nothing here can be done without you)
- Decide whether to merge the PR into `main` (it also brings the corrected contact details onto `main`).
- Production: create a free Neon database; set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, and `NEXT_PUBLIC_SITE_URL` (the final domain); run `npm run db:migrate`, `db:seed`, `admin:create`.
- Contact email: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (no email was sent during testing).
- Search Console and Bing verification and sitemap submission after launch (instructions in `docs/seo-strategy.md`).
- Resume PDF and project screenshots. Optional: decide on remediating the old email in public Git history (procedure in `docs/security.md`; destructive, needs approval).

## Not built (documented, not hidden)
Media library and uploads (images are URLs), revision history, scheduled publishing, preview links, autosave, bulk actions, Services/Resume/SEO/Site-settings managers, navigation and pages managers, contact-message inbox (messages are emailed, or the form says it is not configured; none are stored), redirects, analytics, JSON export, 2FA (deliberately; reasoning in `docs/security.md`), user-management UI.

## Known limitations
- Not tested on a hosted Neon/Vercel deployment or with real email delivery. LinkedIn blocks automated checks (HTTP 999).
- `npm audit` lists 11 moderate advisories in development tooling only (drizzle-kit's bundled esbuild; typescript-eslint's minimatch). No compatible fix exists: the latest releases of both packages carry them and the offered fix downgrades drizzle-kit to 0.18.1. Not applied.
- Changing a published project's slug changes its URL with no redirect; the proxy's valid-slug cache can lag a newly published project by a few seconds; contact rate limiting is in memory (best effort on serverless).
- Scroll reveals use `animation-timeline: view()`: browsers without support show the content without the slide effect.
- The old email remains in public Git history on `main`.
