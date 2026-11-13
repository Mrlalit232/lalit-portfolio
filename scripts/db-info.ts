/**
 * Read-only database overview: which database is targeted, applied migrations, and a row count per table.
 * It only runs SELECT statements, so it is safe against any database. There is no database studio in this project;
 * this is the supported way to look inside.
 *
 *   npm run db:info
 *
 * Targets DATABASE_URL_UNPOOLED / DATABASE_URL if set, otherwise the local embedded database (stop `next dev` first:
 * the embedded database allows one process at a time).
 */
import { sql } from "drizzle-orm";
import { createDb } from "../db/client";

type Rows = { rows: Record<string, unknown>[] };
const run = async (db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, q: ReturnType<typeof sql>) => ((await db.execute(q)) as Rows).rows;

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || undefined;
  const handle = await createDb({ url });
  console.log(`Database: ${handle.kind === "neon" ? "hosted Neon" : "local embedded (PGlite)"}`);
  try {
    const db = handle.db as unknown as Parameters<typeof run>[0];
    try {
      const migrations = await run(db, sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
      console.log(`Applied migrations: ${migrations[0]?.n ?? 0}`);
    } catch {
      console.log("Applied migrations: none recorded yet (run `npm run setup:local` or `npm run db:migrate`).");
    }
    const tables = await run(db, sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`);
    if (tables.length === 0) console.log("No tables yet.");
    for (const t of tables) {
      const name = String(t.table_name);
      if (!/^[a-z_]+$/.test(name)) continue; // identifiers come from the catalogue; refuse anything unexpected
      const n = await run(db, sql.raw(`select count(*)::int as n from "${name}"`));
      console.log(`  ${name.padEnd(22)} ${String(n[0]?.n ?? 0).padStart(6)} row(s)`);
    }
    try {
      const types = await run(db, sql`select type, status, count(*)::int as n from content_items where deleted_at is null group by type, status order by type, status`);
      if (types.length) {
        console.log("Content by type and status (not in Trash):");
        for (const r of types) console.log(`  ${String(r.type).padEnd(14)} ${String(r.status).padEnd(10)} ${r.n}`);
      }
    } catch {
      // content_items missing: nothing to summarise
    }
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
