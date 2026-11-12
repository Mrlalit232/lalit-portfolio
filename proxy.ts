import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { projects } from "@/data/projects";

/**
 * With Cache Components a request-time notFound() runs after the response has
 * started, so unknown project URLs would stream a 200. Checking the slug here,
 * before rendering, returns a genuine HTTP 404 with the site's not-found page.
 */
const slugs = new Set(projects.map((p) => p.slug));

export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/")[2];
  if (slug && !slugs.has(slug)) {
    // Rewrite to a path that does not exist so Next renders app/not-found.tsx with a 404 status.
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/projects/:slug",
};
