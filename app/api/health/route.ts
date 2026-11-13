import { connection } from "next/server";
import { hasHostedDb } from "@/db/client";
import { isAdminConfigured } from "@/lib/auth/env";
import { getDb } from "@/lib/db";
import { healthCheck } from "@/lib/content/stats";
import { siteUrlConfigured } from "@/lib/site";

/**
 * Liveness/readiness probe for uptime monitors and deploy checks. Exposes no secrets and no error text:
 * only coarse status flags. HTTP 200 means the site is serving (it falls back to built-in content when
 * the database is down); HTTP 503 is returned only when a configured database is unreachable.
 */
export async function GET() {
  await connection();
  const allowed = hasHostedDb() || process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DB === "1";
  let database: "ok" | "unreachable" | "not-configured" = "not-configured";
  if (allowed) {
    try {
      database = (await healthCheck(await getDb())).ok ? "ok" : "unreachable";
    } catch {
      database = "unreachable";
    }
  }
  const body = {
    status: database === "unreachable" ? "degraded" : "ok",
    database,
    adminConfigured: isAdminConfigured(),
    siteUrlConfigured,
  };
  return Response.json(body, { status: database === "unreachable" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
