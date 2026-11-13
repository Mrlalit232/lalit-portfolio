import { ADMIN_EMAIL, BASE, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const SHOTS = process.argv[2];
const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pub = async (path) => { const r = await fetch(BASE + path); return { status: r.status, html: await r.text() }; };
const waitPublic = async (path, pred, timeout = 12000) => {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < timeout) { last = await pub(path); if (pred(last)) return { ok: true, ...last }; await sleep(400); }
  return { ok: false, ...last };
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon|404 \(Not Found\)/.test(m.text())) consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const toast = (text) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
const fill = async (name, value) => page.locator(`[name="${name}"]`).fill(value);
const confirmDialog = async (label) => page.getByRole("dialog").getByRole("button", { name: label }).click();

// ---------- login ----------
await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(ADMIN_EMAIL);
await page.getByLabel("Password").fill(PW);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/admin", { timeout: 30000 });
await page.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 20000 });
log(true, "login reaches the dashboard inside the admin shell");

// ---------- dashboard shows real data ----------
const dash = await page.locator("#admin-main").innerText();
const card = (label) => { const m = dash.match(new RegExp(label + "\\s+(\\d+)")); return m ? Number(m[1]) : null; };
log(card("Projects") === 3, `dashboard Projects = ${card("Projects")} (expected 3 seeded)`);
log(card("Skills") === 30, `dashboard Skills = ${card("Skills")} (expected 30)`);
log(card("Experience") === 1 && card("Education") === 1 && card("Certifications") === 6 && card("Ventures") === 3 && card("Services") === 7, "dashboard Experience/Education/Certifications/Ventures/Services counts match seed");
log(card("Testimonials") === 0 && /None published/.test(dash), "dashboard Testimonials = 0 and notes none published");
log(/Recent activity/.test(dash) && /Imported existing content|Signed in/.test(dash), "dashboard shows real recent activity");
log(/Database/.test(dash) && /responded in \d+ ms/.test(dash), "dashboard shows live database health");
log(/File storage/.test(dash) && /Media library stores 0 file/.test(dash), "dashboard reports the media library (0 files on a fresh database)");

// ---------- public site parity with seeded DB ----------
{
  const home = await pub("/");
  log(home.status === 200 && home.html.includes("Lalit Kumar Saini") && home.html.includes("GenIQ"), "public home renders from seeded content");
  log(!home.html.includes("Testimonials"), "no Testimonials section while none are published");
  const list = await pub("/projects");
  log(["GenIQ", "BHIM Coaching Center", "Personal Portfolio"].every((t) => list.html.includes(t)), "public /projects lists the 3 seeded projects");
}

// ---------- validation errors ----------
await page.goto(BASE + "/admin/projects/new", { waitUntil: "networkidle" });
await fill("title", "Bad Project");
await fill("slug", "bad-project");
await fill("category", "Web Platforms");
await fill("tagline", "t");
await fill("summary", "s");
await fill("status", "x");
await fill("links", "Click | javascript:alert(1)");
await page.getByRole("button", { name: "Save draft" }).click();
await page.getByText(/Line 1:/).waitFor({ timeout: 15000 });
log(true, "javascript: link is rejected with a field error naming the line");
log((await page.locator('[name="title"]').inputValue()) === "Bad Project", "form keeps the typed values after a validation error");
await page.locator('[name="links"]').fill("Live demo | https://example.com");
await fill("slug", "geniq");
await page.getByRole("button", { name: "Save draft" }).click();
await page.getByText(/already used by another project/).waitFor({ timeout: 15000 });
log(true, "duplicate slug is rejected");

// ---------- create draft -> invisible publicly ----------
await fill("slug", "e2e-project");
await fill("title", "E2E Project");
await fill("tagline", "Created from the admin panel");
await fill("summary", "A project created during end-to-end testing.");
await fill("status", "Test build");
await fill("stack", "Next.js\nTypeScript");
await fill("caseStudy.overview", "First overview paragraph.\n\nSecond overview paragraph.");
await fill("caseStudy.implemented", "Item A\nItem B");
await page.getByRole("button", { name: "Save draft" }).click();
await page.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}/, { timeout: 20000 });
const editUrl = page.url().split("?")[0];
await toast("Saved as a draft");
log(true, "new project saved as a draft and redirected to its edit page");
await page.waitForTimeout(800);
{
  const r = await pub("/projects/e2e-project");
  log(r.status === 404, `draft project is NOT public: /projects/e2e-project -> ${r.status}`);
  const l = await pub("/projects");
  log(!l.html.includes("E2E Project"), "draft project is not on the public /projects list");
  const s = await pub("/sitemap.xml");
  log(!s.html.includes("e2e-project"), "draft project is not in the sitemap");
}

// ---------- publish -> public ----------
await page.getByRole("button", { name: "Publish", exact: true }).click();
await toast("published");
{
  const r = await waitPublic("/projects/e2e-project", (x) => x.status === 200 && x.html.includes("E2E Project"));
  log(r.ok, `publishing makes /projects/e2e-project live (status ${r.status})`);
  const l = await waitPublic("/projects", (x) => x.html.includes("E2E Project"));
  log(l.ok, "published project appears on the public /projects list");
  const h = await waitPublic("/sitemap.xml", (x) => x.html.includes("e2e-project"));
  log(h.ok, "published project appears in the sitemap");
  log(r.html.includes("First overview paragraph.") && r.html.includes("Second overview paragraph."), "case-study paragraphs render on the public page");
  log(!/Challenges/.test(r.html), "no empty Challenges section is rendered");
}

// ---------- edit as draft -> live unchanged ----------
await page.goto(editUrl, { waitUntil: "networkidle" });
await fill("title", "E2E Project RENAMED");
await page.getByRole("button", { name: "Save draft" }).click();
await toast("live version is unchanged");
await page.waitForTimeout(1000);
log((await page.getByText("unpublished changes").count()) > 0, "editor shows the 'unpublished changes' badge");
{
  // Invariant: the draft title must NEVER appear publicly. The old title may take a moment on a cold server.
  let leaked = false;
  let ok = false;
  for (let i = 0; i < 12 && !ok && !leaked; i++) {
    const r = await pub("/projects/e2e-project");
    leaked = r.html.includes("RENAMED");
    ok = r.status === 200 && r.html.includes("E2E Project");
    if (!ok && !leaked) await sleep(400);
  }
  log(ok && !leaked, "live page still shows the old title while the edit is only a draft (draft never leaks)");
}
await page.getByRole("button", { name: "Publish changes" }).click();
await toast("published");
{
  const r = await waitPublic("/projects/e2e-project", (x) => x.html.includes("RENAMED"));
  log(r.ok, "publishing the edit updates the live page");
}

// discard flow
await page.goto(editUrl, { waitUntil: "networkidle" });
await fill("title", "Throwaway Title");
await page.getByRole("button", { name: "Save draft" }).click();
await toast("live version is unchanged");
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Discard changes" }).click();
await confirmDialog("Discard");
await toast("discarded");
await page.waitForTimeout(800);
log((await page.locator('[name="title"]').inputValue()) === "E2E Project RENAMED", "discard restores the live version in the editor");

// ---------- reorder ----------
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
const titles = async () => page.locator("#admin-main ul li a").allInnerTexts();
const before = await titles();
const idx = before.findIndex((t) => t.includes("E2E Project RENAMED"));
await page.locator("#admin-main ul li").nth(idx).locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Move up" }).click();
await toast("Order updated");
await page.waitForTimeout(800);
const after = await titles();
log(after.findIndex((t) => t.includes("E2E Project RENAMED")) === idx - 1, `reorder moved the project up (${idx} -> ${after.findIndex((t) => t.includes("E2E Project RENAMED"))})`);
{
  const l = await waitPublic("/projects", (x) => x.html.indexOf("E2E Project RENAMED") < x.html.indexOf("Personal Portfolio") && x.html.includes("RENAMED"));
  log(l.ok, "public project order follows the admin order");
}

// ---------- search ----------
await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
await page.getByRole("searchbox", { name: "Search content" }).fill("RENAMED");
await page.keyboard.press("Enter");
await page.waitForURL(/\/admin\/search/, { timeout: 15000 });
await page.getByRole("heading", { name: "Search" }).waitFor({ timeout: 15000 });
log((await page.getByRole("link", { name: "E2E Project RENAMED" }).count()) > 0, "global search finds the project");

// ---------- unpublish -> gone ----------
await page.goto(editUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Unpublish" }).click();
await confirmDialog("Unpublish");
await toast("unpublished");
{
  const r = await waitPublic("/projects/e2e-project", (x) => x.status === 404, 20000);
  log(r.ok, `unpublished project is gone publicly with a real 404 (status ${r.status})`);
  const l = await waitPublic("/projects", (x) => !x.html.includes("RENAMED"));
  log(l.ok, "unpublished project disappears from /projects");
}

// ---------- trash / restore / purge ----------
await page.getByRole("button", { name: "Move to Trash" }).click();
await confirmDialog("Move to Trash");
await page.waitForURL(/\/admin\/projects$/, { timeout: 15000 });
await page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
log((await page.getByText("E2E Project RENAMED").count()) > 0, "deleted project is in Trash");
await page.locator("#admin-main ul li").first().locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Restore" }).click();
await toast("restored");
await page.waitForTimeout(800);
await page.goto(BASE + "/admin/projects?status=draft", { waitUntil: "networkidle" });
log((await page.getByText("E2E Project RENAMED").count()) > 0, "restored project returns as a draft");
await page.locator("#admin-main ul li").first().locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Move to Trash" }).click();
await confirmDialog("Move to Trash");
await toast("Trash");
await page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
await page.locator("#admin-main ul li").first().locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Delete forever" }).click();
await confirmDialog("Delete forever");
await toast("Deleted permanently");
await page.waitForTimeout(800);
log((await page.getByText("E2E Project RENAMED").count()) === 0, "delete forever removes it permanently");

// ---------- duplicate ----------
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
await page.locator("#admin-main ul li").filter({ hasText: "GenIQ" }).first().locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Duplicate" }).click();
await toast("Duplicated as a draft");
await page.waitForTimeout(800);
log((await page.getByText("GenIQ (copy)").count()) > 0, "duplicate creates a '(copy)' draft");
log(!(await pub("/projects")).html.includes("GenIQ (copy)"), "the duplicate is not public until published");

// ---------- testimonials: hidden until real + published ----------
await page.goto(BASE + "/admin/testimonials/new", { waitUntil: "networkidle" });
await fill("name", "Test Person");
await fill("designation", "Tester");
await fill("organization", "Test Org");
await fill("text", "This is a test testimonial created during QA.");
await page.getByRole("button", { name: "Save & publish" }).click();
await page.waitForURL(/\/admin\/testimonials\/[0-9a-f-]{36}/, { timeout: 20000 });
{
  const h = await waitPublic("/", (x) => x.html.includes("This is a test testimonial created during QA."));
  log(h.ok && h.html.includes("What people say."), "published testimonial appears on the home page with its section");
}
const tUrl = page.url().split("?")[0];
await page.getByRole("button", { name: "Unpublish" }).click();
await confirmDialog("Unpublish");
await toast("unpublished");
{
  const h = await waitPublic("/", (x) => !x.html.includes("What people say."));
  log(h.ok, "testimonials section hides again when none are published");
}
await page.goto(tUrl);
await page.getByRole("button", { name: "Move to Trash" }).click();
await confirmDialog("Move to Trash");

// ---------- profile ----------
await page.goto(BASE + "/admin/profile", { waitUntil: "networkidle" });
const origHeadline = await page.locator('[name="headline"]').inputValue();
await fill("headline", "E2E Headline Text");
await fill("email", "e2e-contact@example.test");
await page.getByRole("button", { name: "Save & publish" }).click();
await toast("published");
{
  const h = await waitPublic("/", (x) => x.html.includes("E2E Headline Text"));
  log(h.ok, "profile headline change is live on the home page");
  const c = await waitPublic("/contact", (x) => x.html.includes("mailto:e2e-contact@example.test"));
  log(c.ok, "profile email change is live in the contact page mailto link");
  const f = await pub("/resume");
  log(f.html.includes("e2e-contact@example.test"), "profile email flows to the resume page");
}
await fill("headline", origHeadline);
await fill("email", "lalitkumarsaini510@gmail.com");
await page.getByRole("button", { name: "Save & publish" }).click();
await toast("published");

// ---------- skills / ventures / experience edit flows reach the public site ----------
await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Business Collaboration Ecosystem" }).click();
await page.waitForURL(/\/admin\/ventures\/[0-9a-f-]{36}/);
await fill("status", "Exploration / Concept (E2E)");
await page.getByRole("button", { name: "Save & publish" }).click();
await toast("published");
log((await waitPublic("/ventures", (x) => x.html.includes("Exploration / Concept (E2E)"))).ok, "venture edit is live on /ventures");

// ---------- admin chrome: theme, mobile, overflow, console ----------
await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Switch to light theme/ }).click();
log((await page.evaluate(() => document.documentElement.dataset.adminTheme)) === "light", "theme toggles to light");
await page.reload({ waitUntil: "networkidle" });
log((await page.evaluate(() => document.documentElement.dataset.adminTheme)) === "light", "theme choice persists across reloads");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-dashboard-light-1280.png`, fullPage: true });
await page.getByRole("button", { name: /Switch to dark theme/ }).click();

for (const w of [375, 768, 1024, 1280, 1920]) {
  await page.setViewportSize({ width: w, height: 900 });
  for (const path of ["/admin", "/admin/projects", "/admin/projects/new", "/admin/profile", "/admin/activity", "/admin/skills"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log(ov <= 0, `${w}px ${path} no horizontal overflow (${ov})`);
  }
  if (SHOTS && [375, 1280].includes(w)) {
    await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SHOTS}/admin-dashboard-${w}.png`, fullPage: true });
    await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SHOTS}/admin-projects-${w}.png`, fullPage: true });
  }
}
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open menu" }).click();
log(await page.getByRole("navigation", { name: "Admin" }).last().isVisible(), "mobile drawer opens");
await page.getByRole("navigation", { name: "Admin" }).last().getByRole("link", { name: "Projects" }).click();
await page.waitForURL("**/admin/projects");
log(!(await page.getByRole("button", { name: "Close menu" }).first().isVisible().catch(() => false)), "mobile drawer closes after navigation");
await page.getByRole("button", { name: "Open menu" }).click();
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
log(!(await page.getByRole("button", { name: "Close menu" }).first().isVisible().catch(() => false)), "Escape closes the mobile drawer");

// ---------- access control ----------
const anon = await browser.newContext();
const ap = await anon.newPage();
for (const path of ["/admin", "/admin/projects", "/admin/projects/new", "/admin/profile", "/admin/activity", "/admin/search?q=x"]) {
  const r = await fetch(BASE + path, { redirect: "manual" });
  log([307, 308].includes(r.status) && r.headers.get("location")?.endsWith("/admin/login"), `anonymous ${path} -> ${r.status}`);
}
await ap.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
log(ap.url().endsWith("/admin/login"), "anonymous browser is sent to the login page");
await anon.close();

log(consoleErrors.length === 0, `no console errors in admin session ${consoleErrors.slice(0, 3).join(" | ").slice(0, 300)}`);
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);



