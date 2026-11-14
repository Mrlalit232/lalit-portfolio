# Production configuration guide (Vercel + Neon)

> **Status: prepared, not performed.** Nothing in this repository deploys itself and no deployment has been made. Everything
> here was checked against the code, and the database, build and runtime behaviour was tested **locally**. A hosted
> Neon/Vercel run has **not** been executed; section 10 lists exactly what remains unverified and how to verify it.
> Never put real credentials in this file, in the repository or in chat.

## 1. Architecture at a glance

| Piece | Choice | Notes |
|---|---|---|
| Hosting | Vercel (Next.js 16, Node.js runtime) | Free (Hobby) tier is enough. Use Node 24 (see `.nvmrc`). |
| Database | Neon Postgres (free tier) | Pooled URL for the app, direct URL for migrations. |
| Email | Resend (optional) | Without it the contact form saves to the admin inbox and never claims an email was sent. |
| Cron | Vercel Cron (optional, daily on Hobby) | Backup trigger for scheduled publishing. |
| Media | Stored in Postgres (bytea, 3 MB per file) | No object storage needed. |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Checks only. **No deployment job exists.** |

The local development database is embedded PGlite and is **refused in production** (`db/client.ts`). `ALLOW_LOCAL_DB=1` exists
only so a production build can be tested on your own machine; never set it on Vercel.

## 2. Environment variables

Set these in Vercel, Project Settings, Environment Variables. Names only; generate your own values.

| Variable | Required | Scope | What it does / how to produce it |
|---|---|---|---|
| `DATABASE_URL` | Yes (admin) | Production | Neon **pooled** connection string (host contains `-pooler`). Used by the running app. |
| `DATABASE_URL_UNPOOLED` | Yes (migrations) | Production, and your terminal for one-off commands | Neon **direct** connection string. Used by `npm run db:migrate` and the `admin:*`/`db:*` scripts. |
| `AUTH_SECRET` | Yes (admin) | Production | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. See `docs/security.md` before ever changing it. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Production | The canonical origin, e.g. `https://your-domain.example` (https, no trailing slash). Drives canonical URLs, sitemap, robots, Open Graph and structured data. `/api/health` reports `siteUrlConfigured: false` when it is missing. **It is inlined at build time: change it, then redeploy.** |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Optional | Production | Contact-form email delivery. `CONTACT_FROM_EMAIL` must be a sender verified in Resend. |
| `CRON_SECRET` | Optional | Production | 16+ random characters. Enables `GET /api/cron/publish-scheduled`. Vercel Cron sends it as `Authorization: Bearer <value>` automatically. |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_LINKEDIN_URL`, `NEXT_PUBLIC_GITHUB_URL` | Optional | Production | Override the public contact details in `lib/site.ts`. |
| `ALLOW_LOCAL_DB`, `PGLITE_DIR`, `NEXT_DIST_DIR` | **Never** | none | Local/testing only. |

**Preview deployments.** Do not give previews the production `DATABASE_URL`. Leave it unset in the Preview scope (the public
site then serves the built-in content and the admin shows "not configured"), or create a separate Neon branch for previews.

## 3. Database: first-time setup and safe migrations

The committed migrations (`db/migrations/0000`-`0002`) are **additive** (new tables and nullable columns, no drops; enforced by
`tests/migration.test.ts`). Run them from a trusted machine, not from the build.

1. Create a Neon project (free). Copy the pooled and the direct connection strings.
2. **Before every migration on a database that holds data, create a Neon branch of it** (Branches, Create branch). That is
   a copy-on-write snapshot you can fall back to.
3. Apply and inspect (PowerShell; the variables exist only in that terminal session):
   ```powershell
   $env:DATABASE_URL_UNPOOLED = "<direct connection string>"
   npm run db:migrate      # prints "Applying migrations to: hosted Neon database"
   npm run db:info         # read-only: applied migrations, row counts
   npm run db:seed         # first time only: imports the built-in content as published; never overwrites edits
   npm run admin:create    # interactive; password typed into the hidden prompt, never stored in a file
   Remove-Item Env:DATABASE_URL_UNPOOLED
   ```
   Do not put the production URL in `.env.local`: that file also drives your everyday `npm run dev` database.
4. Sign in at `/admin/login`, then enable two-factor authentication in Admin, Security and store the recovery codes offline.

Future schema changes: generate with `npm run db:generate`, review the SQL, keep it additive (add nullable columns/new tables;
remove old columns only in a later release once no running code reads them). Test on a Neon branch first. The test suite
(`npm test`) applies every migration to a fresh in-memory Postgres and to a populated pre-upgrade database.

## 4. Vercel project settings

1. Import the GitHub repository (Hobby plan). Framework preset: Next.js. Build command `npm run build`, install `npm ci`
   (defaults). Node.js version 24.x.
2. Set the environment variables above, then deploy. **Deploying is a separate, explicit owner decision.**
3. Domain: Settings, Domains, add your domain and follow the DNS instructions at your registrar. Vercel issues and renews the
   TLS certificate automatically. Pick **one** canonical host (apex or `www`), set `NEXT_PUBLIC_SITE_URL` to it, and let Vercel
   redirect the other host to it. The app already sends `Strict-Transport-Security: max-age=31536000`; do not add
   `includeSubDomains` or `preload` unless every subdomain is permanently HTTPS.
4. Optional cron (scheduled publishing backup; Hobby allows daily). Add `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/publish-scheduled", "schedule": "0 6 * * *" }] }
   ```
   With `CRON_SECRET` unset the endpoint answers 404 by design. Scheduled items also publish when someone visits the site.
5. Email (optional): in Resend, verify your sending domain (add the SPF and DKIM DNS records they show), create an API key, set
   the three variables, redeploy, then submit the contact form once and confirm the mail arrives and the message is in the inbox.

## 5. Proxy self-fetch (`proxy.ts`)

The proxy cannot query the database, so it calls three of the site's own routes over HTTP and caches the answers in memory
for a few seconds: `/api/redirects` (CMS redirects), `/api/slugs` (valid project slugs, for real 404s) and `/api/preview-check`
(preview-link validity). Consequences:

- Every cold function instance performs these extra requests (each has a 2.5 s timeout). The cost is a small number of extra
  invocations on a low-traffic portfolio. Failure is safe: redirects and slugs fall back to the last known set (initially none /
  the built-in slugs) and preview checks **fail closed** (a preview link shows a 404).
- **Vercel Deployment Protection** (Vercel Authentication) answers these self-requests with a login page, so on a protected
  preview the CMS redirects and live project slugs are inactive and preview links 404. The production domain is public, so this
  does not affect production. Test redirects and previews on the production domain, or temporarily on an unprotected preview.
- The target origin is the request's own origin. A forged `Host` header was tried against a local production server and did
  **not** make it call another host (see PROJECT_STATUS.md, verified items).

## 6. Security configuration

- Headers (all routes, `next.config.ts`): Content-Security-Policy (`lib/csp.ts`), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. `/admin` and `/preview` are additionally `no-store` and `noindex`.
- Cookies: `__Host-session` and `__Host-2fa` (HttpOnly, Secure, Path=/, no Domain) in production. They are only valid over HTTPS.
- Behind Vercel, the client IP used for rate limiting comes from `x-forwarded-for`, which Vercel sets. If you ever put another
  proxy or CDN in front, make sure it overwrites that header.
- Secrets live only in Vercel and in `.env.local` (git-ignored). Rotation: `docs/security.md`.

## 7. Monitoring and logging

- `GET /api/health` returns `200` (serving), or `503` only if the configured database is unreachable, plus coarse flags:
  `database`, `adminConfigured`, `siteUrlConfigured`. It exposes no secrets. Point a free uptime monitor at it.
- Vercel's runtime logs show server errors (the app logs messages, never passwords, tokens or secrets). No third-party error
  tracker is installed (adding one would be a new dependency and, usually, a paid service); that is a deliberate omission.
- The admin Activity log records sign-ins, failures and content changes.

## 8. Backup and recovery

- Content, users, sessions, messages and media all live in the database. Back up the database, not the code.
- Neon keeps a limited restore history (check the window of your plan in the Neon console) and supports branches. Use a branch
  before risky changes.
- Independent logical backup (needs the PostgreSQL client tools; store the file privately, it contains password hashes and
  contact messages):
  ```bash
  pg_dump "$DATABASE_URL_UNPOOLED" --format=custom --file=portfolio-$(date +%F).dump
  ```
  Restore into a **new** empty Neon database with `pg_restore --no-owner --dbname "<new direct URL>" portfolio-<date>.dump`,
  point `DATABASE_URL`/`DATABASE_URL_UNPOOLED` at it, redeploy, and run `npm run db:info` to compare row counts.
- Lost password or authenticator: `npm run admin:reset-password` / `npm run admin:reset-2fa` with `DATABASE_URL_UNPOOLED` set.

## 9. Rollback

- **Code:** Vercel, Deployments, open the last good deployment, Promote/Instant Rollback. Because migrations are additive,
  the previous code runs on the newer schema.
- **Data:** restore from a Neon branch/point in time, or from a dump (section 8). Content mistakes are usually fixed inside the
  CMS: Trash and revision history restore earlier versions.
- **Configuration:** a wrong environment variable is fixed in Vercel and needs a redeploy (`NEXT_PUBLIC_*` values are inlined at build).

## 10. Post-deploy verification (not yet performed; run these after the first deployment)

Replace `https://your-domain.example`. All checks are read-only except where noted.

| Check | Command / action | Expected |
|---|---|---|
| Health | `curl -s https://your-domain.example/api/health` | `{"status":"ok","database":"ok","adminConfigured":true,"siteUrlConfigured":true}` |
| HTTPS and headers | `curl -sI https://your-domain.example/` | `strict-transport-security`, `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options: nosniff`; no `x-powered-by` |
| Real 404s | `curl -s -o /dev/null -w "%{http_code}" https://your-domain.example/projects/does-not-exist` | `404` |
| Canonical host | `curl -sI http://your-domain.example/` and the other host variant | redirect to the canonical https host |
| SEO | `BASE_URL=https://your-domain.example EXPECT_ORIGIN=https://your-domain.example npm run test:seo` | all pass (read-only) |
| Admin | Sign in, then check the cookie names start with `__Host-` | session works, 2FA prompts |
| Redirect manager | Add a redirect in Admin, open the old path | redirect within about 10 s (proxy self-fetch works) |
| Preview links | Create a preview link for a draft project; open it, then open a changed token | draft visible; changed token 404 |
| Scheduled publishing | Schedule a draft a few minutes ahead and visit the site | it publishes (cron needs `CRON_SECRET`) |
| Contact email | Submit the contact form | message in the inbox, and the email arrives if Resend is configured |
| Lighthouse | PageSpeed Insights on the live URL | record the real numbers; lab scores on a laptop differ |
| Search Console / Bing | Add the property, verify DNS, submit `/sitemap.xml` | owner-only (`docs/seo-strategy.md`) |

## 11. What has and has not been verified

- **Verified locally:** every migration on PGlite (fresh and populated), production build with no database and no secrets,
  the full browser suites against a production build, header output, proxy behaviour, rotation behaviour of `AUTH_SECRET`.
- **Not verified (needs your accounts):** Neon over the WebSocket driver, `db:migrate` against Neon, Vercel build and runtime
  behaviour (including the proxy self-fetch and Deployment Protection), Resend delivery, DNS/TLS, Search Console.
