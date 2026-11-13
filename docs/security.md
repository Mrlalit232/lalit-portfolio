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
- **Headers**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` on all routes; `/admin/*` is additionally
  `no-store`, `noindex` and has a restrictive CSP.
- **Exposure**: `/api/health` returns coarse flags only; `/api/slugs` returns only published project slugs (already public).
- **Secrets**: `.env*` is git-ignored (only `.env.example` is tracked); no secret is in the repository.
- **Dependencies**: `npm audit --omit=dev` reports 0 vulnerabilities for production dependencies.
- **Tested** (browser suites in `tests/e2e`): valid and invalid login, throttling, anonymous and forged-cookie access to
  admin pages, session invalidation after sign-out, draft content never public, validation rejection of malicious input.
- **File uploads**: there is no upload feature, so there is no upload attack surface (images are URLs).

## Remaining risks and recommendations

- `npm audit` (including dev tooling) lists two moderate advisories in development-only packages (drizzle-kit's bundled
  esbuild dev server, ESLint's minimatch). They do not ship to production; the offered fix is a breaking downgrade.
- Contact-form rate limiting is in memory (best effort on serverless). Add a shared store if abuse appears.
- No CSRF token beyond SameSite=Lax cookies and Next's Server Action origin checks (appropriate for this architecture).
- No CSP on the public site (inline JSON-LD and Next's scripts make a strict CSP a larger change); `/admin` has one.
- No 2FA for the admin. Use a long unique password; consider 2FA before adding more admins.
- The old contact email is still in the public Git history on `main` (the commit before the corrected details). Rewriting
  public history was not done; it requires your decision.
- Not tested against a hosted (Neon/Vercel) deployment yet.
