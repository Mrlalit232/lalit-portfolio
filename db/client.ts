import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbHandle = { db: Db; kind: "neon" | "pglite"; close: () => Promise<void> };

export const LOCAL_DB_DIR = ".data/pglite";

/** True when a hosted database is configured. */
export function hasHostedDb() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Creates a database handle.
 *  - DATABASE_URL set          -> Neon (serverless driver, WebSocket pool so transactions work)
 *  - otherwise, dev/test only  -> embedded PGlite (real Postgres compiled to WASM): no account,
 *                                 no cost. `pgliteDir: null` gives an in-memory database for tests.
 * PGlite is single-process, so it is refused in production.
 */
export async function createDb(opts: { url?: string; pgliteDir?: string | null } = {}): Promise<DbHandle> {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const pool = new Pool({ connectionString: url });
    return { db: drizzle(pool, { schema }) as unknown as Db, kind: "neon", close: () => pool.end() };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. The embedded local database is not allowed in production.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  // PGLITE_DIR lets tests and one-off scripts use a separate local database.
  const dir = opts.pgliteDir === undefined ? (process.env.PGLITE_DIR ?? LOCAL_DB_DIR) : opts.pgliteDir;
  if (dir !== null) mkdirSync(dirname(dir), { recursive: true });
  const client = dir === null ? new PGlite() : new PGlite(dir);
  await client.waitReady;
  return { db: drizzle(client, { schema }) as unknown as Db, kind: "pglite", close: () => client.close() };
}

/** Applies committed SQL migrations to the given handle. */
export async function runMigrations(handle: DbHandle, migrationsFolder = "db/migrations") {
  if (handle.kind === "neon") {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    await migrate(handle.db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db as never, { migrationsFolder });
  }
}
