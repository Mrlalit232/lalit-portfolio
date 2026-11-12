# Portfolio CMS: Milestone 1 Audit & Architecture Plan

Status: **proposal for review. No application code has been changed.**
Audited commit: `1009fb6` on `main` (3,741 lines across tracked source files).

---

## 1. Audit of the existing repository

### Stack
Next.js 16.4.6 (App Router, **Cache Components on**, Partial Prefetching on, Turbopack), React 19.3, TypeScript strict, Tailwind 4, Motion 14, Zod 4, lucide-react. No test framework, no `test` script.

### Routes (all prerendered)
`/`, `/about`, `/experience`, `/projects`, `/projects/[slug]` (`generateStaticParams`), `/skills`, `/services`, `/ventures`, `/resume`, `/contact`, `sitemap.xml`, `robots.txt`, generated `icon.svg`, `apple-icon`, `opengraph-image`, `twitter-image`, plus `not-found` and `error`.

### How content is stored today
Static typed modules in `data/`, imported directly by server components (17 importing files):

| File | Content | CMS module it becomes |
|---|---|---|
| `projects.ts` | 3 projects with case-study blocks, links, stack, screenshots, architecture | Projects |
| `ventures.ts` | 3 ventures (stage + status + lists) | Ventures |
| `experience.ts` | 1 role + activities | Experience |
| `skills.ts` | 4 groups, 30 skills with honest "level" labels | Skills |
| `credentials.ts` | 7 entries, mixing education, certifications, participation, activity | Education **and** Certifications (must be split) |
| `services.ts` | 7 services + process steps | Pages/sections blocks |
| `profile.ts` | headline, intro, focus areas, about copy, interests | Profile + Pages |
| `navigation.ts` | nav and footer | Navigation & Footer |

`lib/site.ts` holds site name, URL, and contact links, with environment-variable overrides and defaults for email, LinkedIn and GitHub.

### Server-side code that exists
- `app/contact/actions.ts`: Server Action (Zod, honeypot, min-fill-time, in-memory rate limit, optional Resend REST call). **Messages are not stored anywhere.**
- `proxy.ts`: returns a genuine 404 for unknown `/projects/:slug` (needed because Cache Components streams a 200 after the shell).
- No API routes, no auth, no database, no storage, no analytics.

### SEO (in place and reusable)
`lib/seo.ts` `buildMetadata()` (title, description, canonical, OG, Twitter), `sitemap.ts`, `robots.ts`, Person and CreativeWork JSON-LD, generated OG/Twitter images, `metadataBase` from `NEXT_PUBLIC_SITE_URL`.

### Design system
Dark-only tokens in `globals.css`; primitives in `components/ui/primitives.tsx` (Container, Section, SectionHeading, ButtonLink, Badge, CheckList, PageHero), Motion wrappers (`Reveal`, `Stagger`, `PageTransition`), reusable cards. **No admin-grade components exist**: tables, dialogs, toasts, tabs, form fields, sidebar, skeletons.

### Deployment and environment
- Repo: public `github.com/Mrlalit232/lalit-portfolio`, branch `main`.
- **No Vercel project exists yet** (no `.vercel/`, never deployed; this contradicts the spec's "existing Vercel deployment").
- Current env vars: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_LINKEDIN_URL`, `NEXT_PUBLIC_GITHUB_URL`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`.

### Gaps versus the new spec
No testimonials, education (as its own entity), pages/sections, media, redirects, revisions, activity log, messages store, settings, auth, DB or storage. Everything else maps cleanly onto existing data shapes.

---

## 2. Constraints discovered in this Next.js version (verified in bundled docs)

1. **Cache Components**: managed content should be read through `'use cache'` functions tagged with `cacheTag()`, and invalidated from admin Server Actions with `updateTag()` (read-your-own-writes) or `revalidateTag()` (route handlers). This is what makes "publish without redeploy" work.
2. **Request-time APIs** (`cookies()`, `headers()`) cannot be used inside `'use cache'` scopes. Admin pages therefore read the session **outside** cache scopes and are fully dynamic; public pages never touch cookies.
3. **Server Action body limit is 1 MB by default**, and Vercel functions cap request bodies at roughly 4.5 MB. **Uploads must go browser → Blob directly** using Vercel Blob client uploads with a server-issued token. They must not go through Server Actions.
4. **Server Actions have built-in Origin/Host CSRF checks.** Route handlers do not, so every admin route handler must verify `Origin` itself.
5. **Proxy runs on Node.js** (not Edge), so it can make a database query, but doing that per request would be slow and costly.
6. **Runtime caching of `'use cache'` is host-dependent.** The docs say some hosts do not store request-time cache output. I have not verified Vercel's behavior, and must test it on a real deployment in Milestone 7. Until then, "no redeploy needed" is an expectation, not a proven fact.
7. **A database outage at build time would break prerendering** of DB-backed routes, so reads need a fallback (see §5).

---

## 3. Proposed architecture

### Layers (strict separation)
```
db/schema/*          Drizzle table definitions (models)
db/migrations/*      generated SQL, committed
lib/db.ts            Neon client (server-only)
lib/dal/*            data access layer: queries only, no business rules
lib/services/*       business logic: validation, status transitions, revisions, activity
lib/content/*        PUBLIC read API: 'use cache' + cacheTag, published rows only
lib/auth/*           password hashing, sessions, guards, rate limiting
app/admin/**         admin UI (server components + small client islands)
app/admin/_actions/* Server Actions: each calls requireAdmin(permission) first
app/api/admin/*      route handlers only where Actions cannot work (blob upload token, export)
components/admin/*   admin design system
```
Public pages keep their markup. Only their data source changes: `import { projects } from "@/data/projects"` becomes `await getPublishedProjects()`.

### Public read path and caching
- `lib/content/*` functions are `'use cache'` with tags such as `projects`, `project:<slug>`, `profile`, `settings`, `nav`, `sections:<page>`.
- Every admin mutation ends with `updateTag(...)` for the affected tags (plus `sitemap`).
- Reads return **only `status = published AND deleted_at IS NULL`** (and `scheduled_at <= now` when set). This filter lives in one place so draft isolation is enforceable and testable.
- **Fallback**: if the DB is not configured or unreachable, `lib/content` serves the existing `data/*.ts` content. The portfolio stays operational at every milestone, and the `data/` files become the seed source and the emergency fallback. They are never deleted.

### Draft / publish model (decision needed, recommendation below)
Each content row stores **live columns** plus a nullable `draft jsonb`. Editing a published item writes to `draft` only. **Publish** copies draft into live columns, writes a revision, clears `draft`, and invalidates tags. Drafts of never-published items are `status = draft` rows. This gives true "edit without affecting the live site", preview, and unsaved-change recovery with one mechanism for every module.

### Preview
Separate dynamic route `/preview/[token]/...` that renders draft overlays. Token = HMAC-signed `{entity, id, exp}` using `AUTH_SECRET`, expiring in 30 minutes, `noindex`, `Cache-Control: no-store`, and only generated by an authenticated admin action. It never touches the public cache.

### Autosave
Client-side recovery in `localStorage` keyed by entity+version, with a "restore unsaved draft?" prompt, and a `beforeunload` guard. Server-side drafts are saved only on explicit Save, so unknown intermediate states never reach the DB.

### Revisions
`revisions(entity_type, entity_id, version, snapshot jsonb, changed_by, created_at, note)`. A snapshot is written on each publish and each save-to-draft. Restore creates a *new* draft from the snapshot after confirmation (history is append-only).

### Trash / safe delete
`deleted_at` soft delete for all content; media delete is blocked while referenced. Permanent delete is a separate, confirmed action, available only from trash.

### Redirects
`redirects(source unique, destination, code 301|302, active)`. Loop and duplicate checks on write. Slug change prompts to create one automatically. Runtime: the existing `proxy.ts` gains a small **in-memory table cache (60 s TTL per instance)** loaded with one query. No per-request DB hit. It runs before the existing unknown-slug 404 logic.

### Navigation / footer / settings
`settings` key→jsonb table (site identity, contact, socials, resume media id, footer), `nav_items` table. Environment variables become *defaults only*; settings override them, so existing behavior is preserved.

### Pages and sections
`pages(slug, template, status, seo jsonb)` and `page_sections(page_id, type, order, enabled, data jsonb)` where `type` ∈ a **closed registry** of predefined blocks (hero, text, card-grid, project-list, skills-list, experience-list, ventures-list, credentials-list, services-list, cta, testimonials, contact-cta). `data` is validated by a per-type Zod schema. **No raw HTML and no script injection**: copy is stored as plain-text paragraphs, matching today's data shape. A new *kind* of block is developer work, by design.

### Contact messages
Public form now **persists to `contact_messages` first**, then attempts email if configured. A message that was saved can honestly be acknowledged as received even with no email provider, which resolves the current "not configured" limitation. Store a salted hash of the IP, not the raw IP. Rate limiting moves from in-memory to the DB. Admin statuses: new / read / replied / archived, with search, filter and delete.

### Media
Direct browser upload to **Vercel Blob** through an authenticated token route (`handleUpload`): allow-listed content types (jpeg, png, webp, avif, svg-sanitised or excluded, pdf), size caps, safe generated pathnames. A `media` table (id, url, pathname, mime, size, alt, usage refs). Content references media **by id** and resolves the URL at render, so replacing a file cannot break references. `next/image` with `remotePatterns` for the Blob host.

### Search and bulk actions
Postgres full-text search (`tsvector` generated columns, GIN indexes) across projects, skills, experience, education, certifications, pages, media. Bulk actions run **through the same service layer** (same validation, auth, revisions, activity log). They do not use shortcuts.

### Activity log, health, analytics
`activity_log(actor, action, entity, summary, created_at)` written by the service layer. Secrets never logged. `/admin` health panel checks DB (`select 1`) and Blob reachability, server-side only. Analytics is an **optional adapter** (see open questions). Nothing is shown without a configured provider.

### Export / backup
Admin "Export all" produces structured JSON of all content, and media metadata, via an authenticated route. Documentation covers Neon point-in-time restore/branching and re-import.

---

## 4. Authentication and security design

| Requirement | Design |
|---|---|
| Password hashing | **argon2id** via `@node-rs/argon2` (native, works in Vercel's Node runtime) |
| Sessions | 32-byte random token; **only its SHA-256 hash stored** in `sessions`; idle timeout 12 h, absolute 7 d (configurable); revocable per session; "log out everywhere" |
| Cookie | `__Host-session` in production (Secure, `Path=/`, no Domain), `HttpOnly`, `SameSite=Lax`, never readable by JS |
| Route protection | `proxy.ts` does an optimistic redirect for `/admin/*` when no cookie; **the real check is `requireAdmin(permission)` in the data access layer of every page, Action and route handler**. Proxy alone is not trusted. |
| Authorization | `users.role` column and a `can(user, permission)` function from day one. Release 1 has one `owner` role. Adding roles later changes the permission map, not call sites. |
| Login rate limiting | `login_attempts` table keyed by hashed IP and by account; exponential back-off and temporary lockout; constant-time responses; generic error message |
| CSRF | Server Actions: built-in Origin check. Route handlers: explicit `Origin` verification plus session. SameSite cookies as a second layer. |
| Input | Zod on every Action/route; plain-text storage for copy; URL fields restricted to `https:`/`mailto:`; filenames regenerated server-side |
| No registration | There is no signup route. The first admin is created only by CLI. |
| Bootstrap / recovery | `npm run admin:create` and `npm run admin:reset-password` read email and password from an interactive no-echo prompt. No credentials in code, env or chat. Requires `DATABASE_URL`, i.e. control of the infrastructure. |
| Headers | `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, strict CSP on `/admin`, `noindex` on `/admin` and `/preview`, `Disallow: /admin` in robots |
| Secrets | server-only modules (`import "server-only"`); `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTH_SECRET` never `NEXT_PUBLIC_` |

Note: the repository is public, so admin source is public. Security must not depend on obscurity, and does not. No secret is ever committed.

---

## 5. Database schema (Neon Postgres + Drizzle)

Common columns on content tables: `id uuid pk`, `status enum(draft|published|archived)`, `draft jsonb null`, `sort_order int`, `published_at`, `scheduled_at`, `deleted_at`, `created_at`, `updated_at`, `created_by`, `updated_by`, plus per-entity `seo jsonb` where relevant.

| Table | Notes |
|---|---|
| `users`, `sessions`, `login_attempts` | auth |
| `profile` | singleton row |
| `settings`, `nav_items` | site config |
| `projects`, `project_images` | unique slug, `technologies text[]`, features/challenges/outcomes as jsonb arrays, `category_id`, featured flag, links, status lists (`implemented`, `planned`, `future`) preserving today's honesty model |
| `project_categories` | |
| `skill_categories`, `skills` | unique (category, lower(name)); `level` nullable; `visible` |
| `experience`, `education`, `certifications` | credentials split by `kind`: education→`education`; others→`certifications` |
| `ventures` | stage + free status label |
| `testimonials` | **created empty**; public section hidden when none published |
| `pages`, `page_sections` | closed block registry |
| `media` | pathname, url, mime, size, alt, deleted_at |
| `revisions`, `activity_log` | append-only |
| `redirects` | unique source, loop check |
| `contact_messages` | status enum, ip_hash, no public read path |

Indexes: unique slugs, `(status, deleted_at, sort_order)` for public reads, GIN on search vectors, FK indexes. Foreign keys use `restrict` for media, `cascade` only for owned children (images, sections).
Migrations: `drizzle-kit generate` committed to `db/migrations`; applied with an explicit `npm run db:migrate` using the **unpooled** connection string, never automatically at request time.

### Data migration
`npm run db:seed` imports `data/*.ts` into tables **idempotently** (upsert by stable natural key), records an activity entry, and never deletes. `data/` remains in the repo as fallback. Existing wording is preserved verbatim, including the "Built today / Planned" lists and the removed-challenges decision (challenges stay empty until you enter real ones).

---

## 6. Environment variables (to be configured by you, never shared in chat)

| Variable | Purpose | Where |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection | Vercel + `.env.local` |
| `DATABASE_URL_UNPOOLED` | migrations | `.env.local` / CI |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Vercel (auto-added by the integration) + `.env.local` |
| `AUTH_SECRET` | ≥32 random bytes for preview HMAC and IP hashing | Vercel + `.env.local` |
| existing `NEXT_PUBLIC_*`, `RESEND_*` | unchanged; become defaults/overrides | |

---

## 7. New dependencies (kept minimal)
Runtime: `drizzle-orm`, `@neondatabase/serverless`, `@vercel/blob`, `@node-rs/argon2`, `server-only`.
Dev: `drizzle-kit`, `tsx` (CLI scripts), `vitest`, `@electric-sql/pglite` (migration and DAL tests with no external DB or cost), `playwright-core` (the e2e approach already used for QA).
**No UI component library.** Dialogs use native `<dialog>`; toasts, tables and forms are built on the existing primitives.

---

## 8. Cost and plan implications (verify current pricing in each dashboard; I cannot confirm live pricing offline)
- **Neon**: free tier exists. Compute auto-suspends, so first request after idle is slower. Public pages are cached, so visitors are mostly unaffected; admin sees the delay.
- **Vercel Blob**: usage-based with a free allowance on Hobby.
- **Vercel Hobby plan** is intended for **personal, non-commercial** use and limits cron frequency. A portfolio that advertises paid services and ventures may fall under commercial use. **Read Vercel's current terms before launch.** Scheduled publishing is designed to work without cron (publish-time check at read time, effective at cache-expiry granularity), so it does not depend on paid cron.
- Two databases (dev and production) via Neon branches avoid testing against live content.

---

## 9. Milestone plan and verification gates

| Milestone | Scope | Verified by |
|---|---|---|
| **2** DB + auth | Neon, Drizzle, schema, migrations, seed, auth, guards, CLI | PGlite tests (schema, DAL); auth tests (login, lockout, expiry, unauthorized access) |
| **3** Admin shell | layout, dashboard (real queries), design system | lint/tsc/build; responsive Playwright at 375–1920 |
| **4** Content modules | profile, projects, skills, experience, education, certifications, ventures, testimonials, pages | CRUD tests; draft isolation test |
| **5** Advanced CMS | media, publish/preview, revisions, search, bulk, trash | upload validation tests; revision restore; preview token expiry |
| **6** Integrations | SEO, redirects, messages, activity, settings, analytics adapter | metadata/sitemap tests; redirect loop tests |
| **7** Public integration | public reads from DB with fallback | **draft never public**; deployed cache invalidation test |
| **8** QA + docs | full regression, security checks, setup/recovery/backup docs | complete checklist from spec §20–21 |

Each milestone: separate commits on a `cms` branch, no push without your approval, existing public site remains operational (fallback guarantees this).

---

## 10. Open questions (defaults proposed)
1. **Draft overlay vs direct save**: recommended: draft overlay as described in §3.
2. **Deploy the current public site to Vercel first?** Recommended yes (with your approval), so the Neon and Blob integrations and cache behavior can be tested on a real environment.
3. **Vercel plan**: confirm you are comfortable with Hobby terms, or plan to use Pro.
4. **Analytics provider** (Vercel Web Analytics, Plausible, other, or none): decide before Milestone 6; first release can ship without it.
5. **Admin login email**: you will enter it at the CLI prompt in Milestone 2. Do not send it or any password in chat.

---

## 11. Implementation notes (Milestones 3 and 4)

- **Single content table.** Instead of one table per entity, every managed type lives in `content_items` (`data` = live copy, `draft` = unpublished overlay, `status`, `deleted_at`, `sort_order`, partial-unique `(type, slug)`), with a Zod schema per type (`lib/content/schemas.ts`) validating every write. This gave all eight modules one consistent, tested engine. The trade-off is weaker relational constraints than dedicated tables.
- **Case-study pages are request-time.** Combining `generateStaticParams` with the tagged cache caused a first-render race for projects published after the build (a cached "not found" shell with `noindex`). `/projects/[slug]` now resolves its project per request inside `Suspense`; `proxy.ts` still returns a real 404 for unknown slugs using `/api/slugs` with a short in-memory cache (valid-slug changes take effect within ~10 s at the proxy).
- **Cache invalidation** is `updateTag("content:<type>")` from the admin Server Actions. Verified against a production build using the embedded database; behaviour on Vercel is still to be verified after deployment.
- **Changing a published project's slug** changes its public URL and does not create a redirect (the redirect manager is not built).
