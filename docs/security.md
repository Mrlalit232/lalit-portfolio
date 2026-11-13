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
- **File uploads**: there is no upload feature, so there is no upload attack surface (images are URLs).

## Decisions

- **2FA is not implemented, on purpose.** A safe TOTP flow needs the secret encrypted at rest, enrolment verification,
  one-time recovery codes and a reset path that cannot be used to bypass it. A superficial version would add risk, not
  remove it. With a single owner, a long unique password, login throttling and server-side sessions is the right baseline.
  Revisit before adding more admin accounts.
- **Old email in public Git history.** An email address from an early commit on `main` is public in the repository
  history (and may be cached or forked). Nothing was rewritten, and it cannot be fully un-published, only reduced. If you
  want that: (1) stop using that address for anything sensitive, or add a forwarding alias; (2) optionally rewrite history
  with `git filter-repo --replace-text` on a fresh clone, then force-push all branches (this changes every commit hash,
  breaks open PRs and forks, and every collaborator must re-clone); (3) ask GitHub Support to purge cached views and PR refs.
  This is destructive to public history and needs your explicit approval; it is not part of this change.

## Remaining risks and recommendations

- `npm audit` (including dev tooling) lists advisories only in development-only packages (see PROJECT_STATUS.md for the
  current list). They do not ship to production.
- Contact-form rate limiting is in memory (best effort on serverless). Add a shared store if abuse appears.
- No CSRF token beyond SameSite=Lax cookies and Next's Server Action origin checks (appropriate for this architecture).
- No CSP on the public site (inline JSON-LD and Next's scripts make a strict CSP a larger change); `/admin` has one.
- Not tested against a hosted (Neon/Vercel) deployment yet.
