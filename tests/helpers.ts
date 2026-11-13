import { createDb, runMigrations, type DbHandle } from "@/db/client";

/** Fresh in-memory Postgres (PGlite) with all committed migrations applied. */
export async function freshDb(): Promise<DbHandle> {
  const handle = await createDb({ pgliteDir: null, url: "" });
  await runMigrations(handle);
  return handle;
}

export const SECRET = "test-secret-test-secret-test-secret-0123456789";
export const GOOD_PASSWORD = "correct-horse-battery-staple";
