# Browser tests

Playwright (`playwright-core`) driving your installed Google Chrome against a **production build**.
They only ever use a throwaway database.

**Easiest way: `npm run test:browser`.** It does everything below for you (throwaway database and secrets generated in memory,
clean build in `.next-e2e`, production server on port 3130, SEO audit, all nine suites, server shutdown) and exits non-zero if
anything fails. Options: `-- --suites=smoke,security`, `-- --skip-build`, `-- --port=3140`. CI runs exactly this. The manual
steps below are for running a single suite against a server you started yourself.

```bash
# 1. throwaway database (separate folder, throwaway password; refuses your real DB and hosted DBs)
PGLITE_DIR=.data/e2e E2E_PASSWORD='choose-a-throwaway' npm run e2e:setup

# 2. build and serve with that database (stop `next dev` first; the local DB allows one process)
NEXT_DIST_DIR=.next-e2e ALLOW_LOCAL_DB=1 PGLITE_DIR=.data/e2e NEXT_PUBLIC_SITE_URL=http://localhost:3130 npx next build
NEXT_DIST_DIR=.next-e2e ALLOW_LOCAL_DB=1 PGLITE_DIR=.data/e2e npx next start -p 3130

# 3. run (another terminal)
BASE_URL=http://localhost:3130 E2E_PASSWORD='choose-a-throwaway' npm run test:e2e
BASE_URL=http://localhost:3130 npm run test:seo
```

`BASE_URL` is **required** (there is no default) so these suites can never be pointed at your everyday dev server by accident.
`a11y` is a WCAG 2.2 AA audit with axe-core (public pages at 375/1440 px, the open mobile menu, admin in both themes) and
`security` runs the attack scenarios (XSS, SQL injection, traversal, uploads, action replay, headers).
`npm run test:smoke` is a quick route check (every admin and public route renders without console errors).
`features.mjs` exercises the newer modules (media, resume, SEO overrides, redirects, inbox, revisions, preview links, bulk
actions, scheduled publishing, two-factor sign-in) and takes a few minutes (it waits for a scheduled time to pass).

PowerShell: set variables with `$env:NAME = "value"` instead of the `NAME=value` prefix.
`CHROME_PATH` overrides the Chrome location. Suites: `admin` (login, throttling, sessions, access control), `permissions` (Owner vs Editor vs anonymous: captured Server Action requests are replayed with other credentials; an Owner replay is the control),
`cms` (full CRUD, draft/publish, public sync, validation, layouts), `ventures`, `public` (every page at nine widths:
console errors, overflow, headings, images, mobile navigation). Re-run `e2e:setup` with a fresh `PGLITE_DIR` if a run is
interrupted, because the suites create and clean up their own test records.

## Running the suites correctly (and a documented known limitation)

For results you can trust, always: (1) stop `next dev`, (2) delete the old test build folder (`.next-e2e`), (3) run a **clean**
`next build`, (4) create a **fresh** throwaway database with `npm run e2e:setup`, (5) start the server and set `BASE_URL` to it.
Do not reuse an old build folder after deleting only its `cache` subfolder: the build's prerendered pages and the cache can then
disagree, and old test data (for example a project from a previous run) can show up in the sitemap and pages.

**Known limitation (test infrastructure, not a verified application bug): the `/nope` 404 check.** In `tests/e2e/public.mjs`
the check "320px/375px /nope console errors" failed intermittently twice with `Minified React error #418` (a hydration
mismatch on the 404 page), and a related run hit a network-idle timeout on `/nope`. Both happened only on runs that reused an
old build folder (`-NoBuild`) after the cache folder was deleted. It could **not** be reproduced afterwards: the public suite
passed 497/497 on every clean-build run, a 404-page loop after a profile edit and after the CMS suite gave 0 errors, and a stress
run (8 parallel browsers, 580 page loads over all routes) gave 0 errors. The root cause was therefore **not proven**, no
application change was made for it, and the check is kept unchanged (not disabled or weakened). If you ever see it fail on a
clean build with a fresh database, treat it as a real bug and investigate the hydration mismatch on `app/not-found.tsx`.
