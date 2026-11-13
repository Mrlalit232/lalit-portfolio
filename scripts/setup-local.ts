/**
 * One-time local setup, safe to re-run:
 *  - generates AUTH_SECRET in .env.local (git-ignored) if missing
 *  - creates/updates the embedded local database
 * It never touches a hosted database.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { createDb, runMigrations } from "../db/client";

const envFile = ".env.local";
const current = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";

if (/^AUTH_SECRET=.{32,}/m.test(current)) {
  console.log("AUTH_SECRET already set in .env.local");
} else {
  const prefix = current && !current.endsWith("\n") ? "\n" : "";
  appendFileSync(envFile, `${prefix}AUTH_SECRET=${randomBytes(48).toString("base64url")}\n`);
  console.log("Generated AUTH_SECRET in .env.local (never commit this file).");
}

async function main() {
  const handle = await createDb({ url: "" });
  await runMigrations(handle);
  await handle.close();
  console.log("Local database ready (.data/pglite). Next: npm run admin:create");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
