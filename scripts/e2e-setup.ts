/**
 * Prepares a THROWAWAY database for the browser tests (tests/e2e): migrates, seeds the built-in content and
 * creates the test admin. It refuses to run against your real local database or a hosted database.
 *
 *   PGLITE_DIR=.data/e2e E2E_PASSWORD='<throwaway>' npm run e2e:setup
 */
import { resolve } from "node:path";
import { createDb, runMigrations } from "../db/client";
import { seedContent } from "../lib/content/seed";
import { createAdminUser, findUserByEmail } from "../lib/auth/users";

const ADMIN_EMAIL = "e2e-admin@example.test";
const EDITOR_EMAIL = "e2e-editor@example.test";

async function main() {
  const dir = process.env.PGLITE_DIR;
  if (!dir) throw new Error("Set PGLITE_DIR to a separate folder (for example .data/e2e). The test database must never be your real one.");
  if (resolve(dir) === resolve(".data/pglite")) throw new Error("Refusing to use the default local database (.data/pglite). Choose another PGLITE_DIR.");
  if (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED) throw new Error("Refusing to run with DATABASE_URL set: this script is for a local throwaway database only.");
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error("Set E2E_PASSWORD to a throwaway password for the test admin.");

  const handle = await createDb({ url: "", pgliteDir: dir });
  await runMigrations(handle);
  const seeded = await seedContent(handle.db);
  if (!(await findUserByEmail(handle.db, ADMIN_EMAIL))) await createAdminUser(handle.db, { email: ADMIN_EMAIL, password, name: "E2E Admin" });
  if (!(await findUserByEmail(handle.db, EDITOR_EMAIL))) await createAdminUser(handle.db, { email: EDITOR_EMAIL, password, name: "E2E Editor", role: "editor" });
  await handle.close();
  console.log(`Test database ready in ${dir}: ${seeded.created} items seeded, test owner ${ADMIN_EMAIL}, test editor ${EDITOR_EMAIL}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
