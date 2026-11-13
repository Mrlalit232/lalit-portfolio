# Security notes

This is an honest account of what is protected, what was tested, and what remains. No application is "completely secure".

## Protected and tested

- **Authentication**: argon2id password hashes; sessions are random tokens stored only as SHA-256 hashes; 12 h idle /
  7 d absolute expiry; `__Host-` cookie that is HttpOnly, SameSite=Lax and Secure in production.
- **Authorization**: every admin page and Server Action calls `requireAdmin(permission)`; the proxy redirect is only an
  optimistic first layer. Roles (`owner`, `editor`) map to permissions (read, write, publish, delete).
- **Brute force**: database-backed login throttling (5 attempts per account and 20 per IP per 15 minutes).
- **Input validation**: every content type has a Zod schema enforced on the server; links reject `javascript:` URLs;
  duplicate slugs are rejected. The contact form validates server-side, uses a honeypot, a minimum fill time and a
  per-IP limit, and never reports success unless the email was actually sent.
- **XSS**: React escapes output; JSON-LD is serialised with `<` escaped; the contact email HTML-escapes user input.
- **SQL injection**: all queries go through Drizzle's parameterised builder; no raw string-built SQL with user input.
- **Headers**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera, microphone, geolocation, payment, USB off) and `Strict-Transport-Security` (effective once served over HTTPS) on all routes; `/admin/*` is additionally
  `no-store`, `noindex` and has a restrictive CSP.
- **Exposure**: `/api/health` returns coarse flags only; `/api/slugs` returns only published project slugs (already public).
- **Secrets**: `.env*` is git-ignored (only `.env.example` is tracked); no secret is in the repository.
- **Dependencies**: `npm audit --omit=dev` reports 0 vulnerabilities for production dependencies.
- **Tested** (browser suites in `tests/e2e`): valid and invalid login, throttling, anonymous and forged-cookie access to
  admin pages, session invalidation after sign-out, draft content never public, validation rejection of malicious input.
- **Role enforcement** (`tests/e2e/permissions.mjs`): real Server Action requests are captured from an Owner session and
  replayed with Editor and anonymous credentials (publish, move to Trash, save-and-publish). They must be refused and
  must not change state; replaying the same requests as Owner (the control) succeeds. A tampered form (an Editor flipping
  the submit button to `intent=publish`) is also refused. Editors can create and edit drafts only.
- **Two-factor authentication** (TOTP, RFC 6238, verified against the RFC test vectors): the secret is encrypted at rest
  (AES-256-GCM, key derived from `AUTH_SECRET`); a code can be used only once (replay protection with compare-and-set);
  after the password step a short-lived signed marker (no session) leads to the verify step, which is rate limited per
  account and per IP; ten single-use recovery codes are stored only as keyed hashes and shown once; turning 2FA off or
  regenerating codes needs the password AND a valid code, also rate limited. Lost-device recovery is a command-line reset.
- **Hostile input**: NUL characters (which Postgres cannot store and which previously made an admin search fail) are stripped at every
  input boundary; search and filter text is escaped so `%` and `_` are literal; the framework is not advertised in an
  `X-Powered-By` header.
- **Security tests** (`npm run test:security`, throwaway database): anonymous access, forged cookies, owner-only action replay by an Editor
  and anonymous caller (with an Owner control), stored XSS in project fields and contact messages (including a `</script>` breakout in
  JSON-LD), SQL-injection and wildcard strings, path traversal, malformed bodies, oversized and disguised uploads, security
  headers and error-response leakage.
- **File uploads**: authenticated, `media:write` only, at most 4 files of 3 MB per request. The type is decided from the
  file's magic bytes (PNG, JPEG, GIF, WebP, PDF only; SVG and anything scriptable is refused), the extension comes from the
  verified type, filenames are sanitised, alt text is stripped of markup, and files are served with the stored type,
  `nosniff` and a sandboxed `Content-Security-Policy`. A file in use by content or settings cannot be deleted.
- **Preview links**: 256-bit random tokens stored only as SHA-256, expiring (1 hour to 14 days), revocable, `noindex`,
  `no-store`, `Referrer-Policy: no-referrer`; invalid or expired links return a real 404 and never reveal why.
- **Redirects**: internal paths or `https://` targets only; loops, self-redirects and reserved areas (`/admin`, `/api`,
  `/media`, `/preview`) are refused; the proxy re-validates what it reads.
- **Contact inbox and analytics**: message text is always rendered as plain text. Analytics stores only a daily counter per
  path (no cookies, IPs or identifiers), ignores bots, Do Not Track and Global Privacy Control, is same-origin only and rate limited.
- **SEO settings**: titles and descriptions reject `<` and `>`; social images must be uploaded files (by id), not arbitrary URLs.

## Decisions

- **Two-factor authentication is implemented**, with the recovery workflow described above: set-up needs a confirmed code,
  recovery codes are issued once, changes need password plus a code, and a lost device is recovered with
  `npm run admin:reset-2fa` (needs database access, so only whoever controls the infrastructure can do it).
- **Password recovery is by command line** (`npm run admin:reset-password`), not by an emailed link. An email-link reset
  would make email delivery part of the account's security, so it was deliberately not added. A signed-in owner can change
  the password in Admin, Security.
- **Old email in public Git history.** An email address from an early commit on `main` is public in the repository
  history (and may be cached or forked). Nothing was rewritten, and it cannot be fully un-published, only reduced. If you
  want that: (1) stop using that address for anything sensitive, or add a forwarding alias; (2) optionally rewrite history
  with `git filter-repo --replace-text` on a fresh clone, then force-push all branches (this changes every commit hash,
  breaks open PRs and forks, and every collaborator must re-clone); (3) ask GitHub Support to purge cached views and PR refs.
  This is destructive to public history and needs your explicit approval; it is not part of this change.

## Remaining risks and recommendations

- `npm audit` (including dev tooling) lists advisories only in development-only packages (see PROJECT_STATUS.md for the
  current list). They do not ship to production.
- Contact-form and analytics rate limiting are in memory (best effort on serverless). Add a shared store if abuse appears.
- Media bytes live in Postgres: fine for a portfolio (3 MB cap per file) but watch the free-tier storage quota if you upload a lot.
- Scheduled publishing is triggered by page views and an optional daily cron: a scheduled time can be missed by minutes on a
  site with no visitors, never lost.
- No CSRF token beyond SameSite=Lax cookies and Next's Server Action origin checks (appropriate for this architecture).
- No CSP on the public site (inline JSON-LD and Next's scripts make a strict CSP a larger change); `/admin` has one.
- Not tested against a hosted (Neon/Vercel) deployment yet.
