import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { projects } from "@/data/projects";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * 1. /admin/*: optimistic redirect when there is no session cookie. This is a convenience only;
 *    every admin page, action and route handler re-validates the session on the server.
 * 2. Redirects managed in the admin (Redirects module). The proxy cannot query the database, so it reads the
 *    enabled redirects from /api/redirects and caches them in memory for a few seconds. If that endpoint is
 *    unreachable, the last known set (initially none) is used, so the site never breaks because of it.
 * 3. /preview/<token>: asks /api/preview-check whether the token is valid, so an invalid or expired link is a real 404.
 * 4. /projects/<slug>: with Cache Components a request-time notFound() runs after the response has
 *    started, so unknown slugs would stream a 200. Checking here returns a genuine HTTP 404.
 *    The set of valid slugs comes from /api/slugs (published projects) and is cached in memory for a
 *    few seconds, so a newly published project works immediately and an unpublished one stops
 *    resolving within seconds. Until the first successful fetch, the built-in project slugs are used.
 */
let known = new Set(projects.map((p) => p.slug));
let fetchedAt = 0;
const MAX_AGE_MS = 10_000; // refresh at least this often
const MISS_RETRY_MS = 3_000; // re-check a miss at most this often (protects against probing floods)

type RedirectMap = Record<string, { to: string; status: number }>;
let redirectMap: RedirectMap = {};
let redirectsFetchedAt = 0;
const ALLOWED_STATUS = new Set([301, 302, 307, 308]);

async function refresh(origin: string) {
  try {
    const res = await fetch(`${origin}/api/slugs`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const list = (await res.json()) as unknown;
      if (Array.isArray(list) && list.every((s) => typeof s === "string")) {
        known = new Set(list);
        fetchedAt = Date.now();
      }
    }
  } catch {
    // keep serving the last known set
  }
}

async function refreshRedirects(origin: string) {
  redirectsFetchedAt = Date.now(); // set first: a slow/failed fetch must not be retried on every request
  try {
    const res = await fetch(`${origin}/api/redirects`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!res.ok) return;
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object") return;
    const next: RedirectMap = {};
    for (const [from, v] of Object.entries(data as Record<string, { to?: unknown; status?: unknown }>)) {
      if (typeof v?.to === "string" && typeof v.status === "number" && ALLOWED_STATUS.has(v.status)) next[from] = { to: v.to, status: v.status };
    }
    redirectMap = next;
  } catch {
    // keep the last known set
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!pathname.startsWith("/admin/login") && !request.cookies.has(SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (Date.now() - redirectsFetchedAt > MAX_AGE_MS) await refreshRedirects(request.nextUrl.origin);
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const rule = redirectMap[key];
  if (rule) {
    // Only internal paths and https:// URLs are ever stored (validated on save); re-checked here defensively.
    const internal = rule.to.startsWith("/") && !rule.to.startsWith("//");
    if (internal || /^https:\/\//i.test(rule.to)) {
      const target = internal ? new URL(rule.to, request.url) : new URL(rule.to);
      if (internal && request.nextUrl.search) target.search = request.nextUrl.search;
      return NextResponse.redirect(target, rule.status);
    }
  }

  const parts = pathname.split("/");
  if (parts[1] === "preview" && parts[2] && parts.length === 3) {
    let valid = false;
    try {
      const res = await fetch(`${request.nextUrl.origin}/api/preview-check`, {
        method: "POST",
        body: JSON.stringify({ token: parts[2] }),
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      valid = res.ok && ((await res.json()) as { valid?: unknown }).valid === true;
    } catch {
      valid = false; // fail closed: if the check is unavailable, show nothing
    }
    return valid ? NextResponse.next() : NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  if (parts[1] === "projects" && parts[2]) {
    const slug = parts[2];
    const age = Date.now() - fetchedAt;
    if (age > MAX_AGE_MS || (!known.has(slug) && age > MISS_RETRY_MS)) await refresh(request.nextUrl.origin);
    if (!known.has(slug)) {
      // Rewrite to a path that does not exist so Next renders app/not-found.tsx with a 404 status.
      return NextResponse.rewrite(new URL("/__not-found", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  // Every page route, but not Next internals, API routes, uploaded media or files with an extension
  // (icons, robots.txt, sitemap.xml, images...).
  matcher: ["/((?!_next/|api/|media/|.*\\.[a-zA-Z0-9]+$).*)"],
};
