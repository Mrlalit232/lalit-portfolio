/**
 * Route smoke check (development check, NOT product QA): signs in to a throwaway database and confirms that every
 * admin and public route renders with HTTP 200, the expected heading and no browser console errors, and that the
 * new utility endpoints answer correctly. Run after `npm run e2e:setup` and a build (see tests/e2e/README.md).
 */
import { ADMIN_EMAIL, BASE, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const problems = [];
page.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));

await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(ADMIN_EMAIL);
await page.getByLabel("Password").fill(PW);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/admin", { timeout: 30000 });

const adminRoutes = [
  ["/admin", "Dashboard"], ["/admin/profile", "Profile"], ["/admin/projects", "Projects"], ["/admin/skills", "Skills"],
  ["/admin/experience", "Experience"], ["/admin/education", "Education"], ["/admin/certifications", "Certifications"],
  ["/admin/services", "Services"], ["/admin/ventures", "Ventures"], ["/admin/testimonials", "Testimonials"],
  ["/admin/media", "Media library"], ["/admin/resume", "Resume"], ["/admin/seo", "SEO"], ["/admin/redirects", "Redirects"],
  ["/admin/messages", "Contact messages"], ["/admin/analytics", "Analytics"], ["/admin/activity", "Activity"],
  ["/admin/security", "Account security"], ["/admin/projects/new", "New"],
];
for (const [path, heading] of adminRoutes) {
  problems.length = 0;
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  const h1 = (await page.locator("#admin-main h1").first().innerText().catch(() => "")).trim();
  log(res?.status() === 200 && h1.toLowerCase().includes(heading.toLowerCase()) && problems.length === 0, `${path} renders "${h1}" ${problems.length ? "| " + problems[0] : ""}`);
}

// an item's edit page shows the new tools
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
const href = await page.locator('#admin-main a[href^="/admin/projects/"]:not([href$="/new"])').first().getAttribute("href");
problems.length = 0;
await page.goto(BASE + href, { waitUntil: "networkidle" });
log((await page.getByRole("heading", { name: "Revision history" }).count()) === 1 && (await page.getByRole("heading", { name: "Preview link" }).count()) === 1 && problems.length === 0, "an item's edit page shows revision history and preview link tools");

// public routes
for (const path of ["/", "/about", "/projects", "/projects/geniq", "/skills", "/experience", "/services", "/ventures", "/resume", "/contact"]) {
  problems.length = 0;
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  log(res?.status() === 200 && problems.length === 0, `public ${path} renders ${problems.length ? "| " + problems[0] : ""}`);
}

// utility endpoints
const get = async (p, init) => { const r = await fetch(BASE + p, { redirect: "manual", ...init }); return { status: r.status, text: await r.text(), headers: r.headers }; };
log((await get("/media/00000000-0000-4000-8000-000000000000")).status === 404, "unknown media id -> 404");
log((await get("/media/not-a-uuid")).status === 404, "malformed media id -> 404");
log((await get("/preview/" + "x".repeat(40))).status === 404, "unknown preview token -> 404");
const red = await get("/api/redirects");
log(red.status === 200 && typeof JSON.parse(red.text) === "object", "redirects feed is JSON");
log((await get("/api/analytics", { method: "POST", body: JSON.stringify({ path: "/" }) })).status === 204, "analytics endpoint answers 204 (and ignores cross-origin/unattributed posts)");
log((await get("/api/cron/publish-scheduled")).status === 404, "cron endpoint is disabled without CRON_SECRET");
const unauth = await get("/admin/security");
log(unauth.status === 307, "admin pages still redirect anonymous visitors");

await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
