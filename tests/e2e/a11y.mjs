/**
 * Automated accessibility audit with axe-core (WCAG 2.0/2.1/2.2 A and AA rules, including target size) for every public
 * page at mobile and desktop widths and for the admin screens in both themes. Fails on any violation.
 * Automated rules catch only part of WCAG: keyboard and screen-reader behaviour are covered by separate checks.
 */
import { createRequire } from "node:module";
import { ADMIN_EMAIL, BASE, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };

async function audit(page, label) {
  await page.addScriptTag({ path: axePath });
  const out = await page.evaluate(async (tags) => {
    const r = await axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  }, TAGS);
  log(out.length === 0, `${label}${out.length ? " | " + out.map((v) => `${v.id}(${v.impact}) ${v.nodes[0]}`).join("; ").slice(0, 400) : ""}`);
}

const browser = await launch();
const publicPaths = ["/", "/about", "/experience", "/projects", "/projects/geniq", "/skills", "/services", "/ventures", "/resume", "/contact"];
for (const width of [375, 1440]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  for (const path of publicPaths) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await audit(page, `public ${path} @${width}px`);
  }
  // open mobile menu and audit it too
  if (width === 375) {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(400);
    await audit(page, "public mobile menu (open) @375px");
  }
  await page.context().close();
}

// admin, both themes
const adminPaths = ["/admin", "/admin/projects", "/admin/projects/new", "/admin/skills", "/admin/services", "/admin/media", "/admin/resume", "/admin/seo", "/admin/redirects", "/admin/messages", "/admin/analytics", "/admin/activity", "/admin/security", "/admin/profile"];
for (const [width, theme] of [[1280, "dark"], [375, "dark"], [1280, "light"]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await audit(page, `admin login @${width}px`);
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin", { timeout: 30000 });
  if (theme === "light") {
    await page.evaluate(() => { localStorage.setItem("admin-theme", "light"); document.documentElement.dataset.adminTheme = "light"; });
  }
  for (const path of adminPaths) {
    if (path === "/admin/security" || width === 1280 || path === "/admin" || path === "/admin/projects") {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      await audit(page, `admin ${path} @${width}px ${theme}`);
    }
  }
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
