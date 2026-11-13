import { ADMIN_EMAIL, BASE, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pub = async (path) => { const r = await fetch(BASE + path); return { status: r.status, html: await r.text() }; };
const waitPublic = async (path, pred, timeout = 15000) => {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < timeout) { last = await pub(path); if (pred(last)) return { ok: true, ...last }; await sleep(400); }
  return { ok: false, ...last };
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const bad = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) bad.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => bad.push(`pageerror: ${e}`));
const toast = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 });
const fill = (n, v) => page.locator(`[name="${n}"]`).fill(v);
const confirmDialog = (l) => page.getByRole("dialog").getByRole("button", { name: l }).click();
const rowMenu = async (title, item) => {
  const li = page.locator("#admin-main ul li").filter({ hasText: title }).first();
  await li.locator('summary[aria-label^="Actions for this"]').click();
  await page.getByRole("menuitem", { name: item }).click();
};

// ---- rendering, direct URL, auth ----
await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(ADMIN_EMAIL);
await page.getByLabel("Password").fill(PW);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/admin");
await page.getByRole("link", { name: "Ventures" }).first().click();
await page.waitForURL("**/admin/ventures");
await page.getByRole("heading", { name: "Ventures" }).waitFor();
log(true, "sidebar navigation reaches /admin/ventures");
await page.locator("#admin-main ul li").first().waitFor();
await page.waitForFunction(() => document.querySelector("#admin-main h1")?.textContent === "Ventures");
const seeded = await page.locator("#admin-main ul li:visible").count();
log(seeded === 3, `list shows the 3 seeded ventures (${seeded})`);
await page.reload({ waitUntil: "networkidle" });
log((await page.locator("#admin-main ul li").count()) === 3, "page refresh keeps the list");
log((await page.getByText("Website Development Business").count()) > 0, "seeded venture titles render");

// ---- validation ----
await page.goto(BASE + "/admin/ventures/new", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Save draft" }).click();
await page.waitForTimeout(1500);
log(/\/ventures\/new/.test(page.url()), "empty form is rejected (stays on /new)");
log((await page.locator('[role="alert"], [id$="-error"], .text-red-400').count()) > 0, "missing fields show error messages");
await fill("name", "E2E Venture");
await fill("id", "Bad Anchor!");
await page.locator('[name="stage"]').selectOption("concept");
await fill("status", "Concept");
await fill("tagline", "A venture created in a test");
await fill("summary", "Created by the end-to-end test.");
await fill("listTitle", "Ideas");
await fill("items", "One\nTwo");
await fill("note", "Test only. No claims.");
await fill("link.label", "Bad");
await fill("link.href", "javascript:alert(1)");
await page.getByRole("button", { name: "Save draft" }).click();
await page.waitForTimeout(1500);
log(/\/ventures\/new/.test(page.url()), "invalid anchor id + javascript: link rejected server-side");
log((await page.locator('[name="name"]').inputValue()) === "E2E Venture", "typed values are kept after rejection");
await fill("id", "e2e-venture");
await fill("link.href", "https://example.com");
await page.getByRole("button", { name: "Save draft" }).click();
await page.waitForURL(/\/admin\/ventures\/[0-9a-f-]{36}/, { timeout: 20000 });
const editUrl = page.url().split("?")[0];
await toast("Saved as a draft");
log(true, "valid venture saved as draft and redirected to edit page");

// duplicate anchor id
await page.goto(BASE + "/admin/ventures/new", { waitUntil: "networkidle" });
await fill("name", "Dup"); await fill("id", "e2e-venture"); await page.locator('[name="stage"]').selectOption("concept");
await fill("status", "Concept"); await fill("tagline", "t"); await fill("summary", "s"); await fill("listTitle", "L"); await fill("items", "a"); await fill("note", "n");
await page.getByRole("button", { name: "Save draft" }).click();
await page.getByText(/already used/i).first().waitFor({ timeout: 15000 });
log(true, "duplicate anchor id is rejected safely");

// ---- draft invisible; publish visible ----
{
  const r = await pub("/ventures");
  log(!r.html.includes("E2E Venture"), "draft venture is not on public /ventures");
}
await page.goto(editUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Publish", exact: true }).click();
await toast("published");
{
  const r = await waitPublic("/ventures", (x) => x.html.includes("E2E Venture"));
  log(r.ok, "publishing shows the venture on /ventures");
  log(r.ok && r.html.includes("id=\"e2e-venture\""), "anchor id renders on the public page");
}

// ---- edit persists across refresh; live unchanged until publish ----
await page.goto(editUrl, { waitUntil: "networkidle" });
await fill("name", "E2E Venture RENAMED");
await page.getByRole("button", { name: "Save draft" }).click();
await toast("live version is unchanged");
{
  const r = await pub("/ventures");
  log(r.html.includes("E2E Venture") && !r.html.includes("RENAMED"), "live page unchanged while edit is a draft");
}
await page.reload({ waitUntil: "networkidle" });
log((await page.locator('[name="name"]').inputValue()) === "E2E Venture RENAMED", "edit persists after refresh");
await page.getByRole("button", { name: "Publish changes" }).click();
await toast("published");
log((await waitPublic("/ventures", (x) => x.html.includes("RENAMED"))).ok, "publishing the edit updates the public page");

// ---- duplicate action, delete with confirmation ----
await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
await rowMenu("E2E Venture RENAMED", "Duplicate");
await toast("uplicated");
await page.waitForTimeout(800);
await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
log((await page.locator("#admin-main ul li").count()) === 5, "duplicate created a second item (list = 5)");

// delete flow: cancel first
await page.goto(editUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Unpublish" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
await page.waitForTimeout(500);
log((await pub("/ventures")).html.includes("RENAMED"), "cancelling the confirm dialog changes nothing");
await page.getByRole("button", { name: "Unpublish" }).click();
await confirmDialog("Unpublish");
await toast("unpublished");
log((await waitPublic("/ventures", (x) => !x.html.includes("RENAMED"))).ok, "unpublished venture leaves the public page");
await page.getByRole("button", { name: "Move to Trash" }).click();
await confirmDialog("Move to Trash");
await page.waitForURL(/\/admin\/ventures$/, { timeout: 15000 });
await page.goto(BASE + "/admin/ventures?status=trash", { waitUntil: "networkidle" });
log((await page.getByText("E2E Venture RENAMED").count()) > 0, "deleted venture sits in Trash");
// purge both test items
for (const t of ["E2E Venture RENAMED", "E2E Venture RENAMED"]) {
  await page.goto(BASE + "/admin/ventures?status=trash", { waitUntil: "networkidle" });
  if (!(await page.locator("#admin-main ul li").filter({ hasText: t }).count())) break;
  await rowMenu(t, "Delete forever");
  await confirmDialog("Delete forever");
  await toast("Deleted permanently");
}
// duplicate copy: trash then purge
await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
const left = page.locator("#admin-main ul li").filter({ hasText: "E2E Venture" });
const n = await left.count();
for (let i = 0; i < n; i++) {
  await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
  const t = await page.locator("#admin-main ul li").filter({ hasText: "E2E Venture" }).first().locator("a").first().innerText();
  await rowMenu(t, "Move to Trash"); await confirmDialog("Move to Trash"); await toast("Trash");
  await page.goto(BASE + "/admin/ventures?status=trash", { waitUntil: "networkidle" });
  await rowMenu(t, "Delete forever"); await confirmDialog("Delete forever"); await toast("Deleted permanently");
}
await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
log((await page.locator("#admin-main ul li").count()) === 3, "cleanup: list is back to the 3 seeded ventures");
log((await page.getByText("Business Collaboration Ecosystem").count()) > 0, "seeded ventures untouched");

// ---- sign out + session handling ----
await page.getByRole("button", { name: /Account menu/ }).or(page.locator('summary[aria-label="Account menu"]')).first().click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/admin/login", { timeout: 15000 });
log(true, "sign out lands on login");
await page.goto(BASE + "/admin/ventures", { waitUntil: "networkidle" });
log(page.url().endsWith("/admin/login"), "after sign out, /admin/ventures redirects to login");
for (const p of ["/admin/ventures", "/admin/ventures/new", "/admin/ventures/00000000-0000-4000-8000-000000000000"]) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  const body = await r.text();
  log([307, 308].includes(r.status) && !body.includes("Website Development Business"), `anonymous ${p} -> ${r.status}, no content leaked`);
}
// a stale/forged cookie is rejected server-side (proxy only checks presence)
{
  const r = await fetch(BASE + "/admin/ventures", { redirect: "manual", headers: { cookie: "__Host-session=forged-token-value" } });
  const body = await r.text();
  log(!body.includes("Website Development Business") && ([307, 308].includes(r.status) || r.status === 200 && body.includes("NEXT_REDIRECT")), `forged session cookie gets no content (status ${r.status})`);
}

log(bad.length === 0, `no browser console errors/warnings ${bad.slice(0, 3).join(" | ")}`);
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
