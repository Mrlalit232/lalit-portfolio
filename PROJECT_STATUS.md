# Project Status: Lalit Kumar Saini Portfolio

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Motion · Zod · Lucide

## State: deployment-ready, awaiting owner approval and three personal details

Routes: `/` · `/about` · `/experience` · `/projects` · `/projects/[slug]` (3 case studies) · `/skills` · `/services` · `/ventures` · `/resume` · `/contact` · `/sitemap.xml` · `/robots.txt` · generated `icon.svg`, `apple-icon`, `opengraph-image`, `twitter-image`.

## Content sources
All content is in `data/` (projects, ventures, experience, skills, credentials, services, profile, navigation). Site-wide settings and contact links are in `lib/site.ts`, fed by environment variables.

## Completed in the production-readiness pass
- GitHub profile (`https://github.com/Mrlalit232`) and the BHIM repository link added: footer, contact page, JSON-LD `sameAs`, BHIM case study. Taken from the owner's own local repository remote and verified to return HTTP 200.
- Email and LinkedIn wired everywhere (footer, contact page, resume, mailto fallback, JSON-LD). They appear automatically once the env vars are set. Verified with a throwaway test build.
- Unknown `/projects/<slug>` URLs now return a real HTTP 404 via `proxy.ts` (was 200 + noindex).
- Brand social icons (GitHub, LinkedIn) and an email icon in footer and contact page.
- Favicon (`icon.svg`), Apple touch icon, and branded Open Graph / Twitter share image (text only, no fabricated imagery). The default Next.js favicon and starter SVGs were removed.
- Real README; `.env.example` is tracked; `.env*` secrets remain ignored.
- Contact form unchanged in behavior: honest "not configured" state with email fallback, never a fake success.

## Verification (last run)
- ESLint clean · `tsc --noEmit` clean · production build succeeds.
- Link crawl of all 12 pages: 12 internal links and 3 external links return 200; no broken in-page anchors.
- Browser QA (Playwright + Chrome), 12 routes × 375/768/1024/1280/1920px: no horizontal overflow, one `h1` per page, labelled form fields, no console errors on real pages, mobile menu keyboard behavior, filters, contact form states, reduced motion, content corrections. 287 of 293 checks passed; of the 6 non-passes, 5 are the browser logging the intentional 404 for `/nope` and 1 was a faulty test selector (verified manually).
- Desktop nav verified at 1280/1920px; at 1024px the mobile menu is used by design.
- Not run: automated accessibility audit (axe/Lighthouse), real email delivery, social-preview validators on a live URL.

## Limitations / pending
- LinkedIn URL and public email address not yet set (see env vars).
- Contact delivery not configured (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`).
- Resume PDF, project screenshots, custom domain pending. Each is a drop-in addition (no restructuring).
- GitHub links exist only for BHIM; GenIQ and this portfolio have no public repository link yet.
- Contact rate limit is in-memory (best effort on serverless).
- Git: repository exists on branch `master` with only the original create-next-app commit; all portfolio work is uncommitted.
