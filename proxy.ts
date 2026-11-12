import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { projects } from "@/data/projects";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * 1. /admin/*: optimistic redirect when there is no session cookie. This is a convenience only;
 *    every admin page, action and route handler re-validates the session on the server.
 * 2. /projects/<slug>: with Cache Components a request-time notFound() runs after the response has
 *    started, so unknown slugs would stream a 200. Checking here returns a genuine HTTP 404.
 *    The set of valid slugs comes from /api/slugs (published projects) and is cached in memory for a
 *    few seconds, so a newly published project works immediately and an unpublished one stops
 *    resolving within seconds. Until the first successful fetch, the built-in project slugs are used.
 */
let known = new Set(projects.map((p) => p.slug));
let fetchedAt = 0;
const MAX_AGE_MS = 10_000; // refresh at least this often
const MISS_RETRY_MS = 3_000; // re-check a miss at most this often (protects against probing floods)

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname !== "/admin/login" && !request.cookies.has(SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  const slug = pathname.split("/")[2];
  if (slug) {
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
  matcher: ["/projects/:slug", "/admin", "/admin/:path*"],
};
