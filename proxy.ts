import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { projects } from "@/data/projects";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * 1. /admin/*: optimistic redirect when there is no session cookie. This is a convenience only;
 *    every admin page, action and route handler re-validates the session on the server.
 * 2. /projects/<slug>: with Cache Components a request-time notFound() runs after the response has
 *    started, so unknown slugs would stream a 200. Checking here returns a genuine HTTP 404.
 */
const slugs = new Set(projects.map((p) => p.slug));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname !== "/admin/login" && !request.cookies.has(SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  const slug = pathname.split("/")[2];
  if (slug && !slugs.has(slug)) {
    // Rewrite to a path that does not exist so Next renders app/not-found.tsx with a 404 status.
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:slug", "/admin", "/admin/:path*"],
};
