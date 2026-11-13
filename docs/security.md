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
- **Headers**: `Content-Security-Policy` (see below), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera, microphone, geolocation, payment, USB off) and `Strict-Transport-Security` (effective once served over HTTPS) on all routes; `/admin/*` and `/preview/*` are additionally `no-store` and `noindex`.
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

## Content-Security-Policy

One policy for the whole site, defined in `lib/csp.ts` and sent from `next.config.ts` (unit-tested in `tests/csp.test.ts`; the
browser suites check the header and fail on any console violation).

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self'; connect-src 'self'; media-src 'self'; manifest-src 'self'; worker-src 'self' blob:; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'          (+ upgrade-insecure-requests on an https site)
```

- **No third-party origin is allowed anywhere.** That is accurate for this site: fonts are self-hosted at build time by `next/font`,
  images come from `/media/<id>` or `/public`, the only browser request is the same-origin analytics beacon, and the contact
  email is sent by the server. If you ever add an external script, font, image host or embed, add that origin here on purpose.
- **Why `script-src` still contains `'unsafe-inline'` (a real limitation, not an oversight).** Next.js streams its React Server
  Components payload and bootstrap data in inline `<script>` tags. Two ways to remove `'unsafe-inline'` were evaluated:
  (1) a per-request nonce needs every page rendered per request, which disables the static / partially prerendered pages that
  make this site fast (the Next.js documentation states nonces and Partial Prerendering are incompatible); (2) Subresource
  Integrity hashes (`experimental.sri`) were **tried against a production build and rejected**: with `script-src 'self'` the
  browser blocked the inline payload scripts on every page (the browser suite reported the violations; the payloads differ per
  page and per content, so they cannot be hash-listed). The policy therefore blocks everything else (no foreign scripts, no
  `<object>`, no framing, no foreign form targets, no base-URL tricks) and relies on output escaping for injected markup, which the
  security suite attacks directly (stored XSS in every field, `</script>` breakouts in JSON-LD).
- `style-src 'unsafe-inline'` is needed for React and `next/image` inline style attributes.
- `next dev` additionally allows `'unsafe-eval'` and WebSockets (React debugging and hot reload); production never does.
- Media files are served with their own stricter `default-src 'none'; sandbox` policy.

## `AUTH_SECRET`

**What it is.** A long random string held only in the environment (`.env.local` locally, Vercel in production). It is never stored in
the database or the repository.

**What it is used for** (all of it in `lib/auth`):

| Use | Effect of changing the value |
|---|---|
| Key (HKDF, then AES-256-GCM) that encrypts each user's TOTP secret at rest | **Enrolled two-factor secrets become unreadable.** Authenticator codes can no longer be verified. |
| Keyed hash (HMAC-SHA-256) of single-use recovery codes | **Existing recovery codes stop working.** |
| Signature of the 5-minute "password OK, 2FA pending" cookie | An in-flight second step fails once; the user signs in again. |
| Keyed hash of IPs and account names in login-throttling rows | Throttling counters effectively reset. |
| Session tokens | **Not affected.** Sessions are random tokens stored as plain SHA-256 hashes, so they stay valid. |
| Passwords | **Not affected** (argon2id with a per-hash salt). |

These effects are verified by `tests/secret-rotation.test.ts`.

**Generate** (48 random bytes, 64 characters; never paste it into chat, tickets or commits):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Locally `npm run setup:local` creates one in `.env.local`. In production set it in Vercel (Production scope only). It must be at
least 32 characters or the admin refuses to run.

**When to rotate.** Only if it may have leaked (a pasted log, a shared screenshot, a compromised machine or account with access
to the Vercel project) or as an occasional hygiene step. Rotating is disruptive for accounts with two-factor authentication, so do
not do it casually.

**Rotation procedure** (plan roughly 15 minutes; do it from a trusted machine):

1. Generate a new value. Keep the old one until step 6.
2. Make sure you can reach the database with `DATABASE_URL_UNPOOLED` from your own machine (the recovery tool needs it).
3. Replace `AUTH_SECRET` in Vercel (Production) and redeploy. From this moment two-factor sign-in fails (the server log says the
   stored secret cannot be decrypted and names the fix); password-only accounts and open sessions are unaffected.
4. For each account that used two-factor authentication run `npm run admin:reset-2fa` (it only clears the 2FA data and recovery
   codes; it does not need either secret).
5. Sign in with the password, then Admin, Security, set up two-factor again and store the **new** recovery codes offline.
6. Destroy the old value everywhere (password manager notes, shell history, clipboard).
7. **If the old secret leaked**, also run `npm run admin:reset-password` for every account: it signs out all existing sessions,
   which a rotation alone does not do. An attacker holding only the old secret cannot create a session (the second-step cookie
   never grants one), so this is defence in depth.

**Recovery if it is lost or wrong.** A missing or too-short value makes the admin report "not configured" (the public site keeps
working). Set a valid value, redeploy and follow steps 4-5 for two-factor accounts. Nothing else needs repair.

## Decisions

- **Two-factor authentication is implemented**, with the recovery workflow described above: set-up needs a confirmed code,
  recovery codes are issued once, changes need password plus a code, and a lost device is recovered with
  `npm run admin:reset-2fa` (needs database access, so only whoever controls the infrastructure can do it).
- **Password recovery is by command line** (`npm run admin:reset-password`), not by an emailed link. An email-link reset
  would make email delivery part of the account's security, so it was deliberately not added. A signed-in owner can change
  the password in Admin, Security.
- **Older contact address in public Git history (investigated, not rewritten).** The first commit of the site on `main`
  (`1009fb6`) shipped a different default contact address in `lib/site.ts`; commit `569ebac` replaced it, so no current tip
  of `main` contains it. It is still present in that commit's history, and **also in the tip of the remote
  `revert-1-feature/elite-portfolio-quality-upgrade` branch**, because that branch reverts the whole upgrade. Every commit's
  author metadata uses the current public address (already public by design), and no other personal address, password or token
  was found in the full history (scan of all refs and file contents). The address can be reduced but never fully un-published
  (clones, forks, caches). Recommended order, safest first: (1) stop relying on that address for anything sensitive, or forward
  it; (2) decide on the revert branch (see PROJECT_STATUS.md; deleting an unused remote branch does not touch `main`, but it is
  your call); (3) only if you still want it gone: `git filter-repo --replace-text` on a fresh clone, force-push every branch
  (this rewrites every commit hash, breaks open PRs and forks, and every collaborator must re-clone), then ask GitHub Support
  to purge cached views and PR refs. Step 3 is destructive to public history and needs your explicit approval; no history was
  rewritten and no force-push was made.

## Remaining risks and recommendations

- `npm audit` (including dev tooling) lists advisories only in development-only packages (see PROJECT_STATUS.md for the
  current list). They do not ship to production.
- Contact-form and analytics rate limiting are in memory (best effort on serverless). Add a shared store if abuse appears.
- Media bytes live in Postgres: fine for a portfolio (3 MB cap per file) but watch the free-tier storage quota if you upload a lot.
- Scheduled publishing is triggered by page views and an optional daily cron: a scheduled time can be missed by minutes on a
  site with no visitors, never lost.
- No CSRF token beyond SameSite=Lax cookies and Next's Server Action origin checks (appropriate for this architecture).
- The CSP still allows inline scripts (`script-src 'self' 'unsafe-inline'`); see "Content-Security-Policy" below for why and what compensates.
- Not tested against a hosted (Neon/Vercel) deployment yet.
