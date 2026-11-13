/**
 * Application security checks against a running build and a THROWAWAY database. Attack scenarios:
 * unauthenticated access, privilege escalation by replaying captured Server Actions, stored XSS (including a JSON-LD
 * "</script>" breakout), SQL injection and wildcard input, path traversal, malformed requests, unsafe uploads,
 * security headers and information leakage in error responses. Temporary records are created and purged by the script.
 */
import { request as pwRequest } from "playwright-core";
import { ADMIN_EMAIL, BASE, EDITOR_EMAIL, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (path, init) => { const r = await fetch(BASE + path, { redirect: "manual", ...init }); return { status: r.status, text: await r.text(), headers: r.headers }; };
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(400); } return null; };
const LEAK = /node_modules|\.next[\\/]|at\s+\S+\s+\(|stack|ECONN|password_hash|AUTH_SECRET|postgres:\/\//i;

const browser = await launch();
async function login(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin", { timeout: 30000 });
  return { ctx, page };
}
const owner = await login(ADMIN_EMAIL);
const editor = await login(EDITOR_EMAIL);
const page = owner.page;
const confirmDialog = (l) => page.getByRole("dialog").getByRole("button", { name: l }).click();
const toast = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 20000 });

/* ---------------- 1. unauthenticated access ---------------- */
for (const p of ["/admin", "/admin/projects", "/admin/media", "/admin/seo", "/admin/redirects", "/admin/messages", "/admin/security", "/admin/analytics", "/admin/projects/new"]) {
  const r = await get(p);
  log(r.status === 307 && !/Dashboard|Media library|Contact messages/.test(r.text), `anonymous ${p} -> ${r.status}, no content`);
}
{
  // A forged session cookie passes the proxy's presence check but must fail the real server-side check.
  const r = await get("/admin/seo", { headers: { cookie: "session=forged-value; __Host-session=forged-value" } });
  log(!/Site defaults|Save SEO settings/.test(r.text), "a forged session cookie never reveals admin content");
}
{
  // A Server Action POST without credentials: the proxy redirects before any action code runs.
  const r = await get("/admin/projects", { method: "POST", headers: { "next-action": "00".repeat(20), "content-type": "text/plain;charset=UTF-8" }, body: "[]" });
  log([307, 308, 400, 404].includes(r.status) && !LEAK.test(r.text), `unauthenticated Server Action POST is refused (${r.status})`);
}

/* ---------------- 2. public API and utility endpoints ---------------- */
{
  const slugs = JSON.parse((await get("/api/slugs")).text);
  log(Array.isArray(slugs) && slugs.every((s) => /^[a-z0-9-]+$/.test(s)), "/api/slugs exposes only published slugs");
  const health = (await get("/api/health")).text;
  log(!LEAK.test(health) && !/\bemail\b|\.data/.test(health), "/api/health exposes only coarse flags");
  log((await get("/api/cron/publish-scheduled")).status === 404, "cron endpoint is disabled without CRON_SECRET");
  const bad = await get("/api/preview-check", { method: "POST", body: "{not json" });
  log(bad.status === 200 && JSON.parse(bad.text).valid === false && !LEAK.test(bad.text), "malformed JSON to /api/preview-check fails closed without details");
  const bad2 = await get("/api/analytics", { method: "POST", body: "\u0000￿<script>" });
  log(bad2.status === 204, "malformed body to /api/analytics is ignored (204)");
  const cross = await get("/api/analytics", { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify({ path: "/" }) });
  log(cross.status === 204, "cross-origin analytics post is ignored");
  log((await get("/api/redirects")).status === 200 && !/token|password|email/i.test((await get("/api/redirects")).text), "/api/redirects exposes only public redirect rules");
}

/* ---------------- 3. SQL injection, wildcard and traversal ---------------- */
for (const q of ["' OR 1=1; --", "%", "_", "\\", "'; DROP TABLE content_items; --", "\u0000"]) {
  await page.goto(BASE + "/admin/search?q=" + encodeURIComponent(q), { waitUntil: "networkidle" });
  const ok = (await page.getByRole("heading", { name: "Search" }).count()) > 0 && !LEAK.test(await page.locator("#admin-main").innerText());
  log(ok, `admin search survives ${JSON.stringify(q).slice(0, 30)}`);
}
const projectRows = async () => (await page.locator("#admin-main ul li:visible").allInnerTexts()).map((t) => t.split("\n")[0].trim()).sort();
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
const projectsBefore = await projectRows(); // whatever earlier suites left behind is the baseline
{
  await page.goto(BASE + "/admin/projects?q=" + encodeURIComponent("%") + "&status=" + encodeURIComponent("' OR '1'='1"), { waitUntil: "networkidle" });
  const rows = await page.locator("#admin-main ul li:visible").count();
  log(rows === 0, `a wildcard filter ('%') is matched literally, not as a pattern (${rows} rows)`);
  await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
  log(JSON.stringify(await projectRows()) === JSON.stringify(projectsBefore), `the projects table is unchanged after the injection attempts (${projectsBefore.length} rows)`);
}
for (const p of ["/media/..%2f..%2f.env", "/media/%2e%2e/%2e%2e/package.json", "/media/%00", "/preview/..%2f..%2fadmin", "/projects/..%2fadmin", "/projects/%27%20OR%201=1--"]) {
  const r = await get(p);
  log([307, 308, 400, 404].includes(r.status) && !LEAK.test(r.text) && !/"name":\s*"lalit-portfolio"/.test(r.text), `traversal/injection path ${p} -> ${r.status}`);
}

/* ---------------- 4. stored XSS, including a JSON-LD breakout ---------------- */
let xssFired = false;
const watch = (p) => { p.on("dialog", async (d) => { xssFired = true; await d.dismiss(); }); };
watch(page);
const TITLE = '<img src=x onerror=alert(1)> XSS Probe';
const SUMMARY = '</script><script>window.__xss=1</script> summary "quoted" \'single\' & <b>bold</b>';
await page.goto(BASE + "/admin/projects/new", { waitUntil: "networkidle" });
const f = (n, v) => page.locator(`[name="${n}"]:visible`).fill(v);
await f("title", TITLE); await f("slug", "xss-probe"); await f("category", "Web"); await f("tagline", "Probe <script>window.__xss=2</script>");
await f("summary", SUMMARY); await f("status", "Test"); await f("stack", "TypeScript"); await f("caseStudy.overview", "<iframe src=javascript:alert(1)></iframe>"); await f("caseStudy.implemented", "Item");
await page.getByRole("button", { name: /Save & publish/ }).click();
await page.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}/, { timeout: 20000 });
const xssEdit = new URL(page.url()).pathname;
const live = await waitFor(async () => (await get("/projects/xss-probe")).status === 200);
log(Boolean(live), "a project with hostile text is accepted as data and published");
{
  const html = (await get("/projects/xss-probe")).text;
  log(!html.includes("<img src=x onerror") && !html.includes("<script>window.__xss") && !html.includes("<iframe src=javascript"), "hostile markup is HTML-escaped in the public page source");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let parsed = true;
  try { blocks.forEach((b) => JSON.parse(b)); } catch { parsed = false; }
  log(parsed && blocks.length >= 3 && !blocks.some((b) => b.includes("</script")), "JSON-LD stays valid and a '</script>' in content cannot break out of it");
  const pub = await (await browser.newContext()).newPage();
  watch(pub);
  await pub.goto(BASE + "/projects/xss-probe", { waitUntil: "networkidle" });
  await pub.waitForTimeout(800);
  log(!(await pub.evaluate(() => window.__xss)) && (await pub.locator('img[src="x"]').count()) === 0, "no injected script ran and no injected element exists on the case-study page");
  log((await pub.locator("body").innerText()).includes("<img src=x onerror=alert(1)>"), "the payload is displayed as plain text");
  await pub.goto(BASE + "/projects", { waitUntil: "networkidle" });
  await pub.waitForTimeout(500);
  log(!(await pub.evaluate(() => window.__xss)) && (await pub.locator('img[src="x"]').count()) === 0, "the projects list is also safe");
  await pub.goto(BASE + "/sitemap.xml", { waitUntil: "load" });
  log(!(await pub.content()).includes("<img src=x"), "the sitemap carries no injected markup");
}
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
log(!(await page.evaluate(() => window.__xss)) && (await page.locator('#admin-main img[src="x"]').count()) === 0, "the admin list renders hostile text safely");
await page.goto(BASE + xssEdit, { waitUntil: "networkidle" });
log(!(await page.evaluate(() => window.__xss)) && (await page.locator('#admin-main img[src="x"]').count()) === 0, "the admin editor renders hostile text safely");

// contact form + inbox
{
  const v = await (await browser.newContext()).newPage();
  watch(v);
  await v.goto(BASE + "/contact", { waitUntil: "networkidle" });
  await v.waitForTimeout(3500);
  await v.getByLabel("Your name").fill("<script>window.__xss=3</script> Attacker");
  await v.getByLabel("Email address").fill("attacker@example.com");
  await v.getByLabel("Message").fill('<img src=x onerror=alert(3)> This is a hostile but long enough message body for validation.');
  await v.getByRole("button", { name: "Send message" }).click();
  await v.getByText("Message received").waitFor({ timeout: 20000 });
  await page.goto(BASE + "/admin/messages", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  log(!(await page.evaluate(() => window.__xss)) && (await page.locator('#admin-main img[src="x"]').count()) === 0 && (await page.locator("#admin-main").innerText()).includes("window.__xss=3"), "a hostile contact message is shown as inert text in the inbox");
  await page.locator("details", { hasText: "Attacker" }).first().locator("summary").click();
  await page.getByRole("button", { name: "Delete" }).first().click();
  await confirmDialog("Delete forever");
  await toast("deleted permanently");
}
log(!xssFired, "no JavaScript dialog fired anywhere during the XSS probes");

/* ---------------- 5. owner-only settings: replay as Editor / anonymous ---------------- */
{
  const got = [];
  await page.route("**/*", (route) => {
    const r = route.request();
    if (r.method() === "POST" && r.headers()["next-action"]) { got.push({ url: r.url(), headers: r.headers(), body: r.postDataBuffer() }); return route.abort(); }
    return route.continue();
  });
  await page.goto(BASE + "/admin/seo", { waitUntil: "networkidle" });
  await page.locator('[name="title:/about"]').fill("Hijacked Title");
  await page.getByRole("button", { name: "Save SEO settings" }).click();
  const t = Date.now();
  while (!got.length && Date.now() - t < 8000) await sleep(100);
  await page.unroute("**/*");
  log(got.length === 1, "captured the real owner 'Save SEO settings' Server Action");
  const replay = async (api) => {
    const h = { ...got[0].headers };
    for (const k of ["cookie", "content-length", "host", "connection", "accept-encoding"]) delete h[k];
    return (await api.post(got[0].url, { headers: h, data: got[0].body, failOnStatusCodeError: false, maxRedirects: 0 })).status();
  };
  const anon = await pwRequest.newContext();
  const se = await replay(editor.ctx.request);
  const sa = await replay(anon);
  console.log(`  (replay statuses: editor ${se}, anonymous ${sa})`);
  await sleep(2500);
  log(!(await get("/about")).text.includes("Hijacked Title"), "an Editor and an anonymous replay of an owner-only action change nothing");
  const ownerStatus = await replay(owner.ctx.request);
  const tApplied = Date.now();
  // Public pages are cached for about a minute (the admin says "within a minute"), so allow that window.
  const applied = await waitFor(async () => (await get("/about")).text.includes("Hijacked Title"), 75000);
  log(Boolean(applied), `CONTROL: the same request replayed as Owner does apply, so the refusals above are real (owner replay HTTP ${ownerStatus}, live after ${Math.round((Date.now() - tApplied) / 1000)} s)`);
  await page.goto(BASE + "/admin/seo", { waitUntil: "networkidle" });
  await page.locator('[name="title:/about"]').fill("");
  await page.getByRole("button", { name: "Save SEO settings" }).click();
  await toast("SEO settings saved");
  log(Boolean(await waitFor(async () => !(await get("/about")).text.includes("Hijacked Title"), 75000)), "the temporary SEO override was removed");
  await anon.dispose();
}
{
  await editor.page.goto(BASE + "/admin/seo", { waitUntil: "networkidle" });
  log((await editor.page.getByRole("button", { name: "Save SEO settings" }).count()) === 0, "the Editor's SEO page offers no save button");
  const r = await editor.page.goto(BASE + "/admin/redirects", { waitUntil: "networkidle" });
  log(r?.status() === 200 && (await editor.page.getByRole("button", { name: "Add redirect" }).count()) === 0, "the Editor's redirects page offers no add form");
}

/* ---------------- 6. unsafe uploads ---------------- */
await page.goto(BASE + "/admin/media", { waitUntil: "networkidle" });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const attempts = [
  ["oversized (3 MB + 1)", { name: "big.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024 + 1)]) }, /larger than 3 MB/],
  ["HTML renamed .png", { name: "page.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") }, /Only PNG, JPEG/],
  ["SVG with script", { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>") }, /Only PNG, JPEG/],
  ["executable renamed .jpg", { name: "run.jpg", mimeType: "image/jpeg", buffer: Buffer.from("MZ\x90\x00\x03\x00\x00\x00") }, /Only PNG, JPEG/],
  ["empty file", { name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) }, null],
];
for (const [label, file, expect] of attempts) {
  if (file.buffer.length === 0) continue; // browsers do not submit empty files; the server also rejects them (unit-tested)
  await page.locator("#media-files").setInputFiles(file);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const shown = await page.getByText(expect).first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  log(shown, `upload refused: ${label}`);
}
await page.goto(BASE + "/admin/media", { waitUntil: "networkidle" });
log((await page.locator("ul li", { hasText: /big|page|run|x\.svg/ }).count()) === 0, "none of the refused files were stored");

/* ---------------- 7. headers ---------------- */
{
  const pubH = (await get("/")).headers;
  log(pubH.get("x-content-type-options") === "nosniff" && pubH.get("x-frame-options") === "DENY" && /strict-origin/.test(pubH.get("referrer-policy") ?? "") && /camera=\(\)/.test(pubH.get("permissions-policy") ?? "") && /max-age=\d+/.test(pubH.get("strict-transport-security") ?? ""), "public pages send nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy and HSTS");
  const admH = (await get("/admin/login")).headers;
  log(/no-store/.test(admH.get("cache-control") ?? "") && /noindex/.test(admH.get("x-robots-tag") ?? "") && /frame-ancestors 'none'/.test(admH.get("content-security-policy") ?? ""), "admin responses are no-store, noindex and carry a CSP");
  const m = await get("/media/00000000-0000-4000-8000-000000000000");
  log(m.status === 404 && !LEAK.test(m.text), "a missing media id leaks nothing");
  log(!/x-powered-by/i.test([...pubH.keys()].join(",")), "the server does not advertise X-Powered-By");
}

/* ---------------- cleanup ---------------- */
await page.goto(BASE + xssEdit, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Unpublish" }).click();
await confirmDialog("Unpublish");
await toast("unpublished");
await page.getByRole("button", { name: "Move to Trash" }).click();
await confirmDialog("Move to Trash");
await page.waitForURL(/\/admin\/projects$/, { timeout: 20000 });
await page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
const row = page.locator("#admin-main ul li:visible", { hasText: "XSS Probe" }).first();
await row.locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Delete forever" }).click();
await confirmDialog("Delete forever");
await toast("Deleted permanently");
log(Boolean(await waitFor(async () => (await get("/projects/xss-probe")).status === 404)), "the temporary XSS probe project is gone (404) after cleanup");

await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
