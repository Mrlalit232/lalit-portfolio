/**
 * Content-Security-Policy for the whole site (public pages and /admin).
 *
 * Every resource the site loads is same-origin: fonts are self-hosted by next/font at build time, images are
 * served from this origin (/media/<id>, /public), and the only browser-side request is the same-origin
 * analytics beacon. So the policy can be tight: nothing from any third-party origin is allowed.
 *
 * Scripts: see `scriptSrc` below for the exact trade-off.
 */
export type CspOptions = {
  /** `next dev` needs eval for React's debugging features. Never true in production. */
  dev?: boolean;
  /** Send `upgrade-insecure-requests`. Only when the site is really served over HTTPS (not localhost over HTTP). */
  upgradeInsecure?: boolean;
  /** Allow inline scripts. See docs/security.md ("Content-Security-Policy"). */
  inlineScripts?: boolean;
};

export function buildCsp({ dev = false, upgradeInsecure = false, inlineScripts = true }: CspOptions = {}) {
  const scriptSrc = ["'self'"];
  // Next.js streams the React Server Components payload and its bootstrap data in inline <script> tags. A
  // nonce would remove the need for 'unsafe-inline' but forces every page to render per request, which would
  // disable the static/partially-prerendered pages that give this site its speed. The remaining protection is
  // everything else in this policy (no third-party origins, no <object>, no framing, no foreign form targets,
  // locked base URI) plus the escaping of all user content (tests/e2e/security.mjs).
  if (inlineScripts) scriptSrc.push("'unsafe-inline'");
  if (dev) scriptSrc.push("'unsafe-eval'");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // React and next/image set inline style attributes, so inline styles must stay allowed.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": dev ? ["'self'", "ws:", "wss:"] : ["'self'"],
    "media-src": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (upgradeInsecure) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
