# Project Status: Lalit Kumar Saini Portfolio

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Motion · Zod · Drizzle · Postgres (Neon in production, embedded PGlite locally)

## State: code complete for this phase; NOT deployed, not merged to `main`

Branch `cms` holds all work. Deployment, domain, hosted database and Search Console are deliberately pending.

Routes: `/` · `/about` · `/experience` · `/projects` · `/projects/[slug]` · `/skills` · `/services` · `/ventures` · `/resume` · `/contact` · `/sitemap.xml` · `/robots.txt` · `/api/health` · private `/admin/*`.

## Content
Managed in the Admin CMS (database). `data/*.ts` is the seed and the fallback used if the database is unavailable or unseeded. Services and navigation remain in code. Site-wide settings and contact links are in `lib/site.ts`.

## Verified (latest run, production build, throwaway database)
- ESLint clean · `tsc --noEmit` clean · production build succeeds.
- 42 unit/integration tests (auth, content engine, SEO helpers), 0 failures.
- Browser tests (Playwright + Chrome): admin auth/security 18/18, CMS 86/86, Ventures 29/29, public site 497/497 across nine widths (320-1920 px).
- SEO audit (`npm run test:seo`) 200/200: unique titles and descriptions, canonicals, Open Graph, JSON-LD, sitemap, robots, breadcrumbs, internal links, real 404s, noindex admin.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Lighthouse (lab, local production build): desktop performance 98-100; accessibility 98-100, best practices 100, SEO 100 (91 on a case study, see `docs/seo-strategy.md`). Mobile performance varies by run, about 69-93 under Lighthouse's simulated slow-4G/4x-CPU profile (LCP 2.5-4.0 s, CLS 0); with applied throttling home LCP was 2.3-2.8 s. The 90+ mobile target is **not** reliably met; main-thread JavaScript (TBT) is the remaining cost. INP cannot be measured in the lab.

## This phase
- Fixed admin dev-overlay errors (request-time sessions, theme hydration, instant-navigation opt-out).
- Technical SEO: richer JSON-LD (Person, WebSite, ProfilePage, BreadcrumbList, SoftwareSourceCode/CreativeWork), visible breadcrumbs, `og:image` on every page, description clipping, keyword-aware titles, "Keep exploring" internal links, production-URL fallback and health endpoint.
- Performance: public pages no longer wait for JavaScript to become visible (CSS-only route/hero entrance), Motion features lazy-loaded.
- QA automation moved into the repo (`tests/e2e`, `scripts/seo-audit.mjs`, `scripts/e2e-setup.ts`).
- Docs: README, `.env.example`, `docs/seo-strategy.md`, `docs/security.md`.

## Not built / pending
- Not built: media library and uploads, revision history, scheduled publishing, preview links, bulk actions, Services/Resume/SEO/Site-settings managers, contact-message inbox (messages are emailed or not sent; none are stored), redirects, analytics, JSON export.
- External: contact email delivery (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`), Neon database and `AUTH_SECRET` for production, real domain in `NEXT_PUBLIC_SITE_URL`, resume PDF, project screenshots, Search Console / Bing verification.
- Not tested: a hosted Neon/Vercel deployment; real email delivery; social-preview validators on a live URL. LinkedIn blocks automated checks (HTTP 999).
- Known limitations: changing a published project's slug changes its URL with no redirect; proxy slug validity can lag about 10 s; contact rate limit is in memory; case-study pages are rendered per request (slower LCP than static pages); the old email remains in public Git history on `main`.
