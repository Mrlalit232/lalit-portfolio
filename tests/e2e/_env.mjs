import { chromium } from "playwright-core";

/** Where the production build under test is served. */
// No default on purpose: these suites sign in and create/delete records, so they must only ever be pointed at the
// throwaway test server you started yourself (never at your everyday `npm run dev` on port 3000 and its real database).
if (!process.env.BASE_URL) {
  console.error("BASE_URL is not set. Point it at the throwaway test server, e.g. BASE_URL=http://localhost:3130 (see tests/e2e/README.md).");
  process.exit(2);
}
export const BASE = process.env.BASE_URL.replace(/\/$/, "");

/** Password of the throwaway admin created by `npm run e2e:setup`. Never a real account. */
export const PW = process.env.E2E_PASSWORD ?? "";
export const ADMIN_EMAIL = "e2e-admin@example.test";
export const EDITOR_EMAIL = "e2e-editor@example.test";

/** Uses CHROME_PATH if set, otherwise the locally installed Google Chrome (no browser download needed). */
export const launch = () =>
  chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });

export function requirePassword() {
  if (!PW) {
    console.error("E2E_PASSWORD is not set. Run `npm run e2e:setup` first (see tests/e2e/README.md).");
    process.exit(2);
  }
}
