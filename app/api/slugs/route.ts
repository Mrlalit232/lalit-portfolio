import { connection } from "next/server";
import { getProjects } from "@/lib/content/public";

/**
 * Slugs of PUBLISHED projects only (already public information). Used by proxy.ts to return a real
 * HTTP 404 for unknown project URLs. `connection()` keeps this handler dynamic; the data itself comes
 * from the tagged cache, so it updates as soon as content is published or unpublished.
 */
export async function GET() {
  await connection();
  const slugs = (await getProjects()).map((p) => p.slug);
  return Response.json(slugs, { headers: { "Cache-Control": "no-store" } });
}
