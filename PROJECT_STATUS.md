# Project Status: Lalit Kumar Saini Portfolio

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Zod · Drizzle · Postgres (Neon in production, embedded PGlite locally)

## State: code complete and verified **locally**; NOT deployed; hosted (Neon/Vercel) setup NOT verified

- **Merge status:** PR #1 ("Feature/elite portfolio quality upgrade") is **merged into `main`** (merge commit `5148c7d`). `main` contains the complete upgrade.
- **This branch:** `feature/ultimate-portfolio-completion` (from `main` at `5148c7d`) holds the post-merge completion work below and is delivered as a pull request for your review. It is not merged.
- **Deployment:** nothing has been deployed, published or released. The production guide is `docs/deployment.md`.

Routes: `/` · `/about` · `/experience` · `/projects` · `/projects/[slug]` · `/skills` · `/services` · `/ventures` · `/resume` · `/contact` · `/preview/[token]` (private) · `/media/[id]` · `/sitemap.xml` · `/robots.txt` · `/api/health` · private `/admin/*`.

## What exists
Public portfolio plus an admin CMS: content (Profile, Projects, Skills, Experience, Education, Certifications, Services, Ventures, Testimonials) with drafts, publish, unpublish, archive, Trash, duplicate, reorder, bulk actions and pagination; revision history with restore; scheduled publishing; expiring preview links; media library (images and PDFs, stored in Postgres); resume manager; SEO manager; redirect manager (automatic redirects when a published project URL changes); contact-message inbox; privacy-first analytics; TOTP two-factor authentication with recovery codes; change password; dashboard with real counts; activity log. Details in `README.md`.

## Completed in this branch (post-merge audit remediation)
| Audit finding | Result |
|---|---|
| No CI | `.github/workflows/ci.yml`: quality job (hygiene check, ESLint, `next typegen` + `tsc`, unit tests, production dependency audit, build with no database and no secrets) and browser job (`npm run test:browser`). Read-only permissions, **no deployment job**. Plus `.github/dependabot.yml` (weekly, grouped). |
| No reliable typecheck | `npm run typecheck` (`next typegen && tsc --noEmit`), `npm run check` (lint + typecheck + tests). |
| Browser tests needed a manual multi-step setup | `npm run test:browser`: throwaway database and secrets, clean build, server, SEO audit and all nine suites in one command; refuses to run if `DATABASE_URL` is set or the port is 3000. |
| No CSP on public pages | One first-party-only CSP for the whole site (`lib/csp.ts`, `next.config.ts`; media keeps its own `sandbox` policy). **Limitation:** `script-src` still allows `'unsafe-inline'` because Next.js streams inline payload scripts; nonces would disable static/prerendered pages and SRI hashes were tried and rejected (details and compensating controls in `docs/security.md`). |
| `AUTH_SECRET` rotation undocumented | Documented (purpose, generation, rotation, consequences, recovery) and the behaviour is covered by `tests/secret-rotation.test.ts`. An unreadable 2FA secret now gives an actionable server-log message. |
| Stale README / status | README rewritten (first run, type generation, Services CMS-managed, commands, CI, troubleshooting); this file updated. |
| No production guide | `docs/deployment.md` (Neon, Vercel, variables, migrations, email, cron, proxy self-fetch, domain/TLS, monitoring, backup, rollback, post-deploy checklist). |
| Home mobile performance | Page transition changed from fade+slide to slide-only so the hero (the LCP element) is visible from the first frame. Measured effect on simulated LCP: about 3.2 s to 3.0 s (7 runs each). A font-preload experiment gave no gain and was reverted. |
| `revert-1-...` branch | Assessed (below). Left untouched. |
| Old email in Git history | Investigated (below). History not rewritten. |

## Verified (this branch, clean build, fresh throwaway database, Windows 11, Node 24, Chrome)
- **GitHub Actions** (real runner: Ubuntu, Node 24.22, npm 11.19) ran the whole workflow successfully on the branch push: quality job (hygiene, ESLint, typecheck, 90 unit tests, production audit, build with no database or secrets) and browser job (SEO audit and all nine suites). Run: https://github.com/Mrlalit232/lalit-portfolio/actions/runs/43499269379. The first runs failed at `npm ci` (lockfile lacked optional `@emnapi/runtime` entries written on Windows); fixed by completing the lockfile (no version changes).
- Browser suites via `npm run test:browser`: SEO audit **200/200** · smoke 37/37 · admin 18/18 · permissions 19/19 · CMS 87/87 · Ventures 29/29 · public site at nine widths **497/497** · accessibility (axe-core, WCAG 2.2 AA) 55/55 · security 63/63 (4 new CSP checks) · features 38/38.
- ESLint clean · `npm run typecheck` clean · **90 unit/integration tests** passing (7 new: CSP builder, `AUTH_SECRET` rotation) · production build succeeds with no database and no secrets · `npm audit --omit=dev`: 0 vulnerabilities.
- Unit-test flake: on one first run right after heavy machine load, 2 test files reported errors (8 of 10 files passed); 5 consecutive reruns were 90/90. Not reproduced and not diagnosed (each file starts its own in-memory Postgres/WASM). If CI shows it, treat it as a real issue.
- Forged `Host`/`X-Forwarded-Host` headers against a local production server did **not** make the proxy call another host (the redirect-cache poisoning that was suspected could not be reproduced).

## Lighthouse (lab, local production build, medians of 5 mobile / 3 desktop runs; single runs vary by up to about 10 points on this machine)
| Page | Mobile performance (runs) | Mobile LCP | Mobile TBT | Desktop performance | CLS |
|---|---|---|---|---|---|
| Home | **82** (82, 80, 79, 88, 85) | 3.07 s | 473 ms | 100 | 0 |
| About | 96 (90, 91, 96, 96, 97) | 2.76 s | 75 ms | 100 | 0 |
| Skills | 86 (91, 78, 94, 67, 86) | 3.00 s | 351 ms | 100 | 0 |
| Case study (`/projects/geniq`) | 93 (92, 94, 93, 93, 93) | 3.10 s | 100 ms | 100 | 0 |

Earlier the same day, with the same code and a quieter machine, home mobile measured 89, 86 and 89 (7 runs each, ranges 77-93); the final measurement above ran in a noisier period. **Home mobile does not reliably reach 90 on this machine.**

Accessibility, best practices and SEO are 100 on every measured page. Across all audits the same home code has landed between about 82 and 91 depending on machine load (the spread is almost entirely Total Blocking Time, which is noisy under 4x CPU throttling). Simulated mobile LCP stays about 2.6-3.4 s (above the 2.5 s "good" mark) because Lighthouse's slow-4G model charges several round trips; in Chrome with 4x CPU throttling and no network throttling the home LCP element paints at about 0.4 s. INP cannot be measured in a lab run. No score is promised: re-measure with PageSpeed Insights on the deployed site.

## Git: `revert-1-feature/elite-portfolio-quality-upgrade`
A remote branch (tip `8e23b92`, one commit: GitHub's "Revert" of PR #1) with **no open pull request**. It is based on the merge commit, is stale, contains nothing useful, and **merging it would undo the whole upgrade** (173 files, +4016 / -20434) and re-introduce the older default contact address. It does not affect `main`. It was not deleted (not authorised). Recommended: delete it on GitHub when you are sure you will not use it, and never merge it.

## Git: older address in public history
The first site commit on `main` (`1009fb6`) contains an older default contact address in `lib/site.ts`; it was replaced in `569ebac` and is not in any current branch tip except the revert branch above. All commit author metadata is the current public address. No other personal address, password or token exists anywhere in the history (all refs and contents scanned). Nothing was rewritten or force-pushed. Options and the destructive-history procedure: `docs/security.md`.

## Known limitations (read these)
- **`/nope` 404 check, documented known limitation (test infrastructure, NOT a verified application bug, NOT a verified fix).** It failed intermittently twice (React hydration error #418 on the 404 page at 320/375 px, and one network-idle timeout) only on runs that reused an old build folder after deleting just its cache. It did not fail in any clean-build run of this branch (497/497 each time). The test is unchanged. See `tests/e2e/README.md`.
- CSP allows inline scripts (see above). Contact-form and analytics rate limiting are in memory (best effort on serverless); `/api/preview-check` is unauthenticated (256-bit tokens, indexed lookup); the 14 MB Server Action body limit applies to every action.
- `AUTH_SECRET` also keys the 2FA encryption: rotating it requires `npm run admin:reset-2fa` and re-enrolment (`docs/security.md`).
- Not built: autosave; pages/navigation managers; JSON export; user-management screen (Editor role is enforced and tested but accounts come from code/CLI); emailed password-reset links (recovery is by command line, deliberately); an error-tracking service (it would add a dependency and usually a paid plan).
- Media bytes are stored in Postgres (3 MB per file cap): fine for a portfolio, watch the free-tier quota. Scheduled publishing is triggered by visits and an optional cron.
- `npm audit` (all): 11 moderate advisories, all in development tooling (drizzle-kit's bundled esbuild; typescript-eslint's minimatch). No compatible fix exists (the offered fix is a breaking downgrade). Production dependencies: 0.
- Scroll reveals use `animation-timeline: view()`: browsers without support show the content without the slide effect.
- Profile text in `data/profile.ts` only applies to new installs and the fallback; existing database content is edited in Admin, Profile.

## NOT verified (needs your accounts or a real deployment)
Neon over the WebSocket driver and `db:migrate` against Neon; Vercel build/runtime behaviour (including the proxy's self-requests and Deployment Protection); Resend email delivery; DNS/TLS; Search Console and Bing; real-device INP.

## Owner actions (one checklist)
1. Review and merge the pull request when satisfied (it was not merged for you).
2. Decide on the `revert-1-...` branch (delete recommended) and on the optional history rewrite (`docs/security.md`).
3. Production, when you choose to deploy: follow `docs/deployment.md` (Neon database, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`; `npm run db:migrate`, `db:seed`, `admin:create`; enable two-factor; optional Resend keys and `CRON_SECRET`), then run its post-deploy checklist.
4. After launch: Search Console and Bing verification (`docs/seo-strategy.md`); upload the resume PDF in Admin, Resume.
5. Upgrading your local database: stop `next dev`, `npm run setup:local`, then `npm run db:seed` (imports Services; never overwrites your edits).
