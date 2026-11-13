/**
 * One-command, repeatable browser test run (local machine or CI). It:
 *   1. generates THROWAWAY secrets in memory (never written to disk, never printed),
 *   2. wipes and recreates a throwaway database (.data/e2e) and a separate build folder (.next-e2e),
 *   3. builds the production bundle and starts it on a test port,
 *   4. runs the SEO audit and the browser suites (tests/e2e/*.mjs),
 *   5. stops the server and exits non-zero if anything failed.
 *
 * It refuses to run when DATABASE_URL is set, and it never touches your everyday `npm run dev` database.
 *
 *   npm run test:browser                       # everything
 *   npm run test:browser -- --suites=smoke,security
 *   npm run test:browser -- --skip-build       # reuse the previous .next-e2e build
 *   npm run test:browser -- --port=3140
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const ALL_SUITES = ["smoke", "admin", "permissions", "cms", "ventures", "public", "a11y", "security", "features"];
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const suites = args.suites ? args.suites.split(",").map((s) => s.trim()).filter(Boolean) : ALL_SUITES;
const unknown = suites.filter((s) => !ALL_SUITES.includes(s));
if (unknown.length) {
  console.error(`Unknown suite(s): ${unknown.join(", ")}. Available: ${ALL_SUITES.join(", ")}`);
  process.exit(2);
}
const port = Number(args.port ?? 3130);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("--port must be an integer between 1024 and 65535.");
  process.exit(2);
}
if (port === 3000) {
  console.error("Port 3000 is reserved for your everyday dev server. Choose another port.");
  process.exit(2);
}
if (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED) {
  console.error("Refusing to run: DATABASE_URL is set. The browser tests create and delete records and need a throwaway local database.");
  process.exit(2);
}

const env = {
  ...process.env,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  E2E_PASSWORD: `${randomBytes(12).toString("hex")}Aa1!`,
  PGLITE_DIR: ".data/e2e",
  NEXT_DIST_DIR: ".next-e2e",
  ALLOW_LOCAL_DB: "1",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  BASE_URL: `http://localhost:${port}`,
  NEXT_TELEMETRY_DISABLED: "1",
};
// These must never leak into the test run.
for (const k of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "RESEND_API_KEY", "CRON_SECRET", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"]) delete env[k];

const node = process.execPath;
const run = (label, argv) => {
  console.log(`\n== ${label}`);
  const r = spawnSync(node, argv, { env, stdio: "inherit" });
  return r.status ?? 1;
};
const nextBin = "node_modules/next/dist/bin/next";

let server;
const stopServer = () => {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};
process.on("SIGINT", () => { stopServer(); process.exit(130); });

const results = [];
let failed = false;
try {
  rmSync(".data/e2e", { recursive: true, force: true });
  if (!args["skip-build"]) rmSync(".next-e2e", { recursive: true, force: true });

  if (run("create throwaway database", ["--import", "tsx", "scripts/e2e-setup.ts"]) !== 0) throw new Error("e2e setup failed");
  if (!args["skip-build"] && run("production build", [nextBin, "build"]) !== 0) throw new Error("production build failed");

  console.log(`\n== start production server on port ${port}`);
  server = spawn(node, [nextBin, "start", "-p", String(port)], { env, stdio: ["ignore", "ignore", "inherit"] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(1000);
    if (server.exitCode !== null) throw new Error("server exited early");
    try { up = (await fetch(env.BASE_URL, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* not up yet */ }
  }
  if (!up) throw new Error("server did not become ready within 60 s");

  const steps = [["seo-audit", ["scripts/seo-audit.mjs"]], ...suites.map((s) => [s, [`tests/e2e/${s}.mjs`]])];
  for (const [name, argv] of steps) {
    const code = run(name, argv);
    results.push([name, code]);
    if (code !== 0) failed = true;
  }
} catch (error) {
  console.error(`\nRun aborted: ${error instanceof Error ? error.message : error}`);
  failed = true;
} finally {
  stopServer();
}

console.log("\n== summary");
for (const [name, code] of results) console.log(`${code === 0 ? "PASS" : "FAIL"}  ${name}`);
if (!results.length) console.log("(no suites ran)");
process.exit(failed ? 1 : 0);
