import { defineConfig } from "drizzle-kit";

// Used only to *generate* SQL migrations from the schema. Applying them is done by
// `npm run db:migrate` (scripts/migrate.ts), which targets Neon or the local database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
});
