import { chromium } from "playwright-core";

/** Where the production build under test is served. */
export const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Password of the throwaway admin created by `npm run e2e:setup`. Never a real account. */
export const PW = process.env.E2E_PASSWORD ?? "";
export const ADMIN_EMAIL = "e2e-admin@example.test";

/** Uses CHROME_PATH if set, otherwise the locally installed Google Chrome (no browser download needed). */
export const launch = () =>
  chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });

export function requirePassword() {
  if (!PW) {
    console.error("E2E_PASSWORD is not set. Run `npm run e2e:setup` first (see tests/e2e/README.md).");
    process.exit(2);
  }
}
