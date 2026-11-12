/**
 * Imports the existing static content (data/*.ts) into the database as PUBLISHED items.
 * Non-destructive and idempotent: items that already exist (including edits and Trash) are skipped.
 * Targets DATABASE_URL_UNPOOLED / DATABASE_URL if set, otherwise the local embedded database.
 * Run with: npm run db:seed
 */
import { createDb, runMigrations } from "../db/client";
import { seedContent } from "../lib/content/seed";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || undefined;
  const handle = await createDb({ url });
  console.log(`Seeding: ${handle.kind === "neon" ? "hosted Neon database" : "local embedded database"}`);
  await runMigrations(handle);
  const counts = await seedContent(handle.db);
  console.log(`Done. ${counts.created} created, ${counts.skipped} already present.`);
  await handle.close();
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
