/**
 * Owner vs Editor vs anonymous authorization, tested at the Server Action level.
 *
 * Real Server Action requests are CAPTURED from an Owner session (and aborted so they do nothing), then REPLAYED with
 * Editor and anonymous credentials. This is what an attacker with browser dev tools could do, so it does not depend on
 * hidden buttons. An Owner replay at the end is the control: it proves the captured requests are valid, so a
 * rejection above is a real authorization decision and not a malformed request.
 */
import { request as pwRequest } from "playwright-core";
import { ADMIN_EMAIL, BASE, EDITOR_EMAIL, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pubStatus = async (slug) => (await fetch(`${BASE}/projects/${slug}`)).status;
const waitPub = async (slug, want, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await pubStatus(slug)) === want) return true; await sleep(500); } return false; };

const browser = await launch();
const login = async (email) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin", { timeout: 20000 });
  return { ctx, page };
};

const owner = await login(ADMIN_EMAIL);
const editor = await login(EDITOR_EMAIL);
log(true, "owner and editor can both sign in");

const fillProject = async (page, slug, title) => {
  await page.goto(BASE + "/admin/projects/new", { waitUntil: "networkidle" });
  const f = (n, v) => page.locator(`[name="${n}"]`).fill(v);
  await f("title", title); await f("slug", slug); await f("category", "Web"); await f("tagline", "Permission test");
  await f("summary", "Created by the permissions test."); await f("status", "Test"); await f("stack", "TypeScript");
  await f("caseStudy.overview", "Overview."); await f("caseStudy.implemented", "Item");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}/, { timeout: 20000 });
  return page.url().split("?")[0];
};

// ---- Owner creates a draft; editor UI is restricted ----
const editUrl = await fillProject(owner.page, "e2e-perm", "E2E Perm Project");
log((await pubStatus("e2e-perm")) === 404, "draft is not public");
log((await owner.page.getByRole("button", { name: "Publish", exact: true }).count()) > 0 && (await owner.page.getByRole("button", { name: "Move to Trash" }).count()) > 0, "owner sees Publish and Move to Trash");

await editor.page.goto(editUrl, { waitUntil: "networkidle" });
log((await editor.page.getByRole("button", { name: "Save draft" }).count()) > 0, "editor can edit (Save draft is available)");
log((await editor.page.getByRole("button", { name: "Publish", exact: true }).count()) === 0, "editor does not see Publish");
log((await editor.page.getByRole("button", { name: /Save & publish/ }).count()) === 0, "editor does not see Save & publish");
log((await editor.page.getByRole("button", { name: "Move to Trash" }).count()) === 0, "editor does not see Move to Trash");

// ---- capture real Server Action requests as the Owner (aborted: they change nothing) ----
async function capture(label, click) {
  const got = [];
  await owner.page.route("**/*", (route) => {
    const r = route.request();
    if (r.method() === "POST" && r.headers()["next-action"]) { got.push({ url: r.url(), headers: r.headers(), body: r.postDataBuffer() }); return route.abort(); }
    return route.continue();
  });
  await owner.page.goto(editUrl, { waitUntil: "networkidle" });
  await click();
  const t = Date.now();
  while (!got.length && Date.now() - t < 8000) await sleep(100);
  await owner.page.unroute("**/*");
  log(got.length === 1, `captured the real "${label}" Server Action request`);
  return got[0];
}
const publishOp = await capture("Publish (item action)", () => owner.page.getByRole("button", { name: "Publish", exact: true }).click());
const trashOp = await capture("Move to Trash (item action)", async () => { await owner.page.getByRole("button", { name: "Move to Trash" }).click(); await owner.page.getByRole("dialog").getByRole("button", { name: "Move to Trash" }).click(); });
const saveAndPublish = await capture("Save & publish (form action)", () => owner.page.getByRole("button", { name: /Save & publish/ }).click());

const replay = async (api, cap) => {
  const headers = { ...cap.headers };
  for (const h of ["cookie", "content-length", "host", "connection", "accept-encoding"]) delete headers[h];
  const res = await api.post(cap.url, { headers, data: cap.body, failOnStatusCodeError: false, maxRedirects: 0 });
  return res.status();
};

// ---- replay as Editor and as anonymous: must be refused, state must not change ----
const anon = await pwRequest.newContext();
for (const [who, api] of [["editor", editor.ctx.request], ["anonymous", anon]]) {
  const sp = await replay(api, publishOp);
  const st = await replay(api, trashOp);
  const sf = await replay(api, saveAndPublish);
  console.log(`  (${who} replay HTTP statuses: publish ${sp}, trash ${st}, save&publish ${sf})`);
}
await sleep(1500);
log((await pubStatus("e2e-perm")) === 404, "after editor + anonymous replays the item is still NOT public (publish refused)");
await owner.page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
log((await owner.page.locator("#admin-main ul li").filter({ hasText: "E2E Perm Project" }).count()) === 0, "after editor + anonymous replays the item is NOT in Trash (delete refused)");
await owner.page.goto(BASE + "/admin/projects?status=draft", { waitUntil: "networkidle" });
log((await owner.page.locator("#admin-main ul li").filter({ hasText: "E2E Perm Project" }).count()) === 1, "the item is still a draft in the owner's list");

// ---- form tampering: editor flips the submit button to intent=publish ----
await editor.page.goto(editUrl, { waitUntil: "networkidle" });
await editor.page.evaluate(() => { const b = document.querySelector('button[name="intent"][value="save"]'); if (b) b.setAttribute("value", "publish"); });
await editor.page.getByRole("button", { name: "Save draft" }).click();
await sleep(2500);
log((await pubStatus("e2e-perm")) === 404, "editor tampering with the form (intent=publish) does not publish");

// ---- editor can legitimately create a draft ----
const editorUrl = await fillProject(editor.page, "e2e-editor-draft", "E2E Editor Draft");
log(/\/admin\/projects\/[0-9a-f-]{36}/.test(editorUrl), "editor can create a draft");
log((await pubStatus("e2e-editor-draft")) === 404, "the editor's draft is private");

// ---- control: the SAME captured requests succeed for the Owner ----
await replay(owner.ctx.request, publishOp);
log(await waitPub("e2e-perm", 200), "CONTROL: replaying the captured publish request as Owner publishes it (the requests are valid)");
await replay(owner.ctx.request, trashOp);
log(await waitPub("e2e-perm", 404), "CONTROL: replaying the captured trash request as Owner removes it from the public site");

// ---- cleanup (owner) ----
await owner.page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
const purge = async (title) => {
  const li = owner.page.locator("#admin-main ul li").filter({ hasText: title }).first();
  if (!(await li.count())) return;
  await li.locator('summary[aria-label^="Actions for this"]').click();
  await owner.page.getByRole("menuitem", { name: "Delete forever" }).click();
  await owner.page.getByRole("dialog").getByRole("button", { name: "Delete forever" }).click();
  await owner.page.getByText("Deleted permanently").first().waitFor({ timeout: 15000 });
};
await purge("E2E Perm Project");
// the editor's draft: owner trashes then purges
await owner.page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
const row = owner.page.locator("#admin-main ul li:visible").filter({ hasText: "E2E Editor Draft" }).first();
await row.locator('summary[aria-label^="Actions for this"]').click();
await owner.page.getByRole("menuitem", { name: "Move to Trash" }).click();
await owner.page.getByRole("dialog").getByRole("button", { name: "Move to Trash" }).click();
await owner.page.getByText("Trash").first().waitFor({ timeout: 15000 });
await owner.page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
await purge("E2E Editor Draft");
await owner.page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
log((await owner.page.locator("#admin-main ul li:visible").count()) === 3, "cleanup: back to the 3 seeded projects");

await anon.dispose();
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
