# Browser tests

Playwright (`playwright-core`) driving your installed Google Chrome against a **production build**.
They only ever use a throwaway database.

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

PowerShell: set variables with `$env:NAME = "value"` instead of the `NAME=value` prefix.
`CHROME_PATH` overrides the Chrome location. Suites: `admin` (login, throttling, sessions, access control),
`cms` (full CRUD, draft/publish, public sync, validation, layouts), `ventures`, `public` (every page at nine widths:
console errors, overflow, headings, images, mobile navigation). Re-run `e2e:setup` with a fresh `PGLITE_DIR` if a run is
interrupted, because the suites create and clean up their own test records.
