/**
 * Applies committed SQL migrations (db/migrations).
 *   - DATABASE_URL_UNPOOLED / DATABASE_URL set -> Neon (hosted)
 *   - otherwise                                -> embedded local database (.data/pglite)
 * Run with: npm run db:migrate
 */
import { createDb, runMigrations } from "../db/client";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || undefined;
  const handle = await createDb({ url });
  console.log(`Applying migrations to: ${handle.kind === "neon" ? "hosted Neon database" : "local embedded database"}`);
  await runMigrations(handle);
  console.log("Migrations up to date.");
  await handle.close();
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
