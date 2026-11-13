/**
 * Feature check for the newer CMS modules, against a throwaway database (development verification, not final QA):
 * media, resume, SEO overrides, redirects, contact inbox, revisions, preview links, bulk actions, scheduled
 * publishing and two-factor sign-in (including recovery codes). Records are created and cleaned up by the script.
 */
import { createHmac } from "node:crypto";
import { request as pwRequest } from "playwright-core";
import { ADMIN_EMAIL, BASE, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (path, init) => { const r = await fetch(BASE + path, { redirect: "manual", ...init }); return { status: r.status, text: await r.text(), headers: r.headers }; };
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(500); } return null; };

// RFC 6238 TOTP (same algorithm as the app), so the test can act as an authenticator app.
const b32 = (s) => { const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, v = 0; const out = []; for (const c of s.replace(/[\s=]/g, "").toUpperCase()) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, atMs) => { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(atMs / 30000))); const h = createHmac("sha1", b32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0"); };

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const toast = (t, ms = 20000) => page.getByText(t, { exact: false }).first().waitFor({ timeout: ms });
// :visible, because after client navigation the previous page stays mounted (hidden) and would match too.
const fill = (n, v) => page.locator(`[name="${n}"]:visible`).fill(v);
const confirmDialog = (l) => page.getByRole("dialog").getByRole("button", { name: l }).click();

async function login(p, email = ADMIN_EMAIL, password = PW) {
  await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(password);
  await p.getByRole("button", { name: "Sign in" }).click();
}
await login(page);
await page.waitForURL("**/admin", { timeout: 30000 });

/* ---------------- media ---------------- */
await page.goto(BASE + "/admin/media", { waitUntil: "networkidle" });
await page.locator("#media-files").setInputFiles({ name: "../shot.png", mimeType: "image/png", buffer: PNG });
await page.getByRole("button", { name: "Upload", exact: true }).click();
await toast("Uploaded 1 file");
await page.waitForTimeout(800);
const mediaPath = await page.locator("p.font-mono", { hasText: "/media/" }).first().innerText();
log(/^\/media\/[0-9a-f-]{36}$/.test(mediaPath), `uploaded image gets a media path (${mediaPath})`);
{
  const r = await get(mediaPath);
  log(r.status === 200 && r.headers.get("content-type") === "image/png" && r.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(r.headers.get("content-security-policy") ?? ""), "media is served with the verified type, nosniff and a sandboxed CSP");
}
await page.locator("#media-files").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>") });
await page.getByRole("button", { name: "Upload", exact: true }).click();
await toast("Only PNG, JPEG, GIF, WebP images and PDF files are allowed");
log(true, "a disguised SVG/script file is rejected by content, not by its name");
const pngCount = await page.locator("ul li", { hasText: "shot.png" }).count();
log(pngCount === 1, "the sanitised filename shot.png is listed once");

/* ---------------- resume ---------------- */
await page.goto(BASE + "/admin/resume", { waitUntil: "networkidle" });
await page.locator("#resume-file").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
await page.getByRole("button", { name: "Upload", exact: true }).click();
await toast("Uploaded 1 file");
await page.getByRole("button", { name: "Use this file" }).first().click();
await toast("Resume updated");
{
  const href = await waitFor(async () => { const t = (await get("/resume")).text; const m = t.match(/<a[^>]*href="(\/media\/[0-9a-f-]{36})"[^>]*download/) ?? t.match(/<a[^>]*download[^>]*href="(\/media\/[0-9a-f-]{36})"/); return m ? m[1] : null; });
  log(Boolean(href), `the public Resume page now offers the uploaded PDF (${href})`);
  const r = href ? await get(href) : { headers: new Headers() };
  log(r.headers?.get("content-type") === "application/pdf", "the resume PDF is served as application/pdf");
}

/* ---------------- SEO overrides ---------------- */
await page.goto(BASE + "/admin/seo", { waitUntil: "networkidle" });
await fill("title:/about", "Custom About Title");
await fill("description:/about", "A custom meta description written in the SEO manager for the about page, about 120 characters long.");
await page.locator('[name="noindex:/services"]').check();
await page.getByRole("button", { name: "Save SEO settings" }).click();
await toast("SEO settings saved");
{
  const ok = await waitFor(async () => { const t = (await get("/about")).text; return /<title>Custom About Title \| Lalit Kumar Saini<\/title>/.test(t) && t.includes("A custom meta description written in the SEO manager"); });
  log(Boolean(ok), "the SEO override appears in the public /about title and description");
  const sm = await waitFor(async () => { const t = (await get("/sitemap.xml")).text; return !t.includes("/services") ? t : null; });
  log(Boolean(sm), "a page marked noindex is removed from the sitemap");
  const svc = (await get("/services")).text;
  log(/<meta name="robots" content="noindex/.test(svc), "the noindex page carries a robots noindex tag");
}
// restore defaults
await page.goto(BASE + "/admin/seo", { waitUntil: "networkidle" });
await fill("title:/about", ""); await fill("description:/about", "");
await page.locator('[name="noindex:/services"]').uncheck();
await page.getByRole("button", { name: "Save SEO settings" }).click();
await toast("SEO settings saved");
log(Boolean(await waitFor(async () => !(await get("/about")).text.includes("Custom About Title"))), "clearing an override restores the built-in title");

/* ---------------- redirects ---------------- */
await page.goto(BASE + "/admin/redirects", { waitUntil: "networkidle" });
await fill("fromPath", "/old-feature-test"); await fill("toPath", "/about");
await page.getByRole("button", { name: "Add redirect" }).click();
await toast("Redirect added");
{
  const r = await waitFor(async () => { const x = await get("/old-feature-test"); return x.status === 301 ? x : null; }, 25000);
  log(Boolean(r) && new URL(r.headers.get("location"), BASE).pathname === "/about", "a redirect added in the admin redirects the public URL (301 -> /about)");
}
await fill("fromPath", "/admin/hack"); await fill("toPath", "/about");
await page.getByRole("button", { name: "Add redirect" }).click();
await toast("reserved");
log(true, "reserved paths cannot be redirected");
await page.getByRole("button", { name: "Delete" }).first().click();
await confirmDialog("Delete");
await toast("Redirect deleted");
log(Boolean(await waitFor(async () => (await get("/old-feature-test")).status === 404, 25000)), "deleting the redirect stops it (404 again)");

/* ---------------- contact inbox ---------------- */
const visitor = await (await browser.newContext()).newPage();
await visitor.goto(BASE + "/contact", { waitUntil: "networkidle" });
await visitor.waitForTimeout(3500); // minimum fill time
await visitor.getByLabel("Your name").fill("Feature Tester");
await visitor.getByLabel("Email address").fill("feature@example.com");
await visitor.getByLabel("Message").fill("This is an inbox feature test message from the automated check.");
await visitor.getByRole("button", { name: "Send message" }).click();
await visitor.getByText("Message received").waitFor({ timeout: 20000 });
log(/received and saved/i.test(await visitor.locator("form, main").first().innerText()), "the contact form reports 'received and saved' (honest: no email provider configured)");
await page.goto(BASE + "/admin/messages", { waitUntil: "networkidle" });
log((await page.getByText("Feature Tester").count()) > 0 && (await page.getByText("inbox feature test message").count()) > 0, "the message appears in the admin inbox");
const msgDetails = page.locator("details", { hasText: "Feature Tester" }).first();
if (!(await msgDetails.evaluate((e) => e.open))) await msgDetails.locator("summary").click(); // a lone message opens automatically
await page.getByRole("button", { name: "Mark as read" }).click();
await toast("Marked as read");
await page.getByRole("button", { name: "Delete" }).first().click();
await confirmDialog("Delete forever");
await toast("deleted permanently");
log(true, "messages can be marked read and deleted");

/* ---------------- project lifecycle: revisions, preview, bulk, schedule ---------------- */
async function newProject(slug, title) {
  await page.goto(BASE + "/admin/projects/new", { waitUntil: "networkidle" });
  await fill("title", title); await fill("slug", slug); await fill("category", "Web"); await fill("tagline", "Feature test");
  await fill("summary", "Created by the feature check."); await fill("status", "Test"); await fill("stack", "TypeScript");
  await fill("caseStudy.overview", "Overview."); await fill("caseStudy.implemented", "Item");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}/, { timeout: 20000 });
  return page.url().split("?")[0];
}
const url1 = await newProject("feat-one", "Feat One");
await fill("title", "Feat One v2");
await page.getByRole("button", { name: "Save draft" }).click();
await toast("Draft saved");
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });
const revCount = await page.locator("#revisions-heading").locator("xpath=ancestor::section").locator("li").count();
log(revCount >= 2, `revision history lists the saves (${revCount} revisions)`);
await page.getByRole("button", { name: "Restore as draft" }).last().click();
await confirmDialog("Restore as draft");
await toast("restored as a draft");
await page.waitForTimeout(800);
log((await page.locator('[name="title"]:visible').inputValue()) === "Feat One", "restoring the first revision puts the original title back in the draft");

// preview link
await page.getByRole("button", { name: "Create link" }).click();
await toast("Preview link created");
const link = await page.locator("p.font-mono", { hasText: "/preview/" }).first().innerText();
const anon = await (await browser.newContext()).newPage();
const resp = await anon.goto(link, { waitUntil: "networkidle" });
log(resp?.status() === 200 && (await anon.getByRole("heading", { name: "Feat One" }).count()) > 0 && (await anon.getByText("not visible to the public").count()) > 0, "an anonymous visitor can open the draft through the preview link (with a Preview banner)");
log((await get("/projects/feat-one")).status === 404, "the draft is still NOT public");
log(/noindex/.test(resp?.headers()["x-robots-tag"] ?? "") && /no-store/.test(resp?.headers()["cache-control"] ?? "") && resp?.headers()["referrer-policy"] === "no-referrer", "preview responses are noindex, no-store and send no referrer");
await page.getByRole("button", { name: /Revoke 1 active link/ }).click();
await toast("Revoked");
log(Boolean(await waitFor(async () => (await get(new URL(link).pathname)).status === 404)), "a revoked preview link stops working (404)");

// bulk actions
const url2 = await newProject("feat-two", "Feat Two");
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
await page.getByLabel("Select Feat One").check();
await page.getByLabel("Select Feat Two").check();
await page.getByRole("button", { name: "Move to Trash" }).first().click();
await confirmDialog("Move to Trash");
await toast("2 item(s) updated");
await page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
log((await page.getByText("Feat One").count()) > 0 && (await page.getByText("Feat Two").count()) > 0, "bulk Move to Trash moved both selected projects");
await page.getByLabel("Select Feat One").check();
await page.getByLabel("Select Feat Two").check();
await page.getByRole("button", { name: "Delete forever" }).first().click();
await confirmDialog("Delete forever");
await toast("2 item(s) updated");
await page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
log((await page.getByText("Feat One").count()) === 0, "bulk Delete forever removed them (cleanup)");
void url1; void url2;

// scheduled publishing (publishes on the next page-view beacon after the time passes)
await newProject("feat-sched", "Feat Scheduled");
// datetime-local has minute precision: schedule for the next whole minute that is at least ~45 s away.
const when = new Date(Math.ceil((Date.now() + 45_000) / 60_000) * 60_000);
const pad = (n) => String(n).padStart(2, "0");
await page.locator("#schedule-when").fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`);
await page.getByRole("button", { name: "Schedule", exact: true }).click();
await toast("Scheduled to publish");
log((await get("/projects/feat-sched")).status === 404, "a scheduled item is not public before its time");
const live = await waitFor(async () => {
  // Loading a public page fires the page-view beacon, which also triggers the scheduler (throttled to every 30 s).
  await visitor.goto(BASE + "/about", { waitUntil: "load" }).catch(() => {});
  await visitor.waitForTimeout(1500);
  return (await get("/projects/feat-sched")).status === 200;
}, 180000);
log(Boolean(live), "after its time passes the scheduled project goes live automatically");
// cleanup
await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
await page.locator("#admin-main ul li:visible", { hasText: "Feat Scheduled" }).first().locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Move to Trash" }).click();
await confirmDialog("Move to Trash");
await toast("Moved to Trash");
await page.goto(BASE + "/admin/projects?status=trash", { waitUntil: "networkidle" });
await page.locator("#admin-main ul li:visible", { hasText: "Feat Scheduled" }).first().locator('summary[aria-label^="Actions for this"]').click();
await page.getByRole("menuitem", { name: "Delete forever" }).click();
await confirmDialog("Delete forever");
await toast("Deleted permanently");

/* ---------------- two-factor authentication ---------------- */
await page.goto(BASE + "/admin/security", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
const secret = (await page.locator("p.select-all").first().innerText({ timeout: 20000 })).trim();
log(/^[A-Z2-7]{32}$/.test(secret), "setup shows a 160-bit base32 key");
await page.getByLabel("6-digit code").fill("000000");
await page.getByRole("button", { name: "Turn on" }).click();
await toast("not correct");
log(true, "a wrong confirmation code is rejected");
await page.getByLabel("6-digit code").fill(totp(secret, Date.now()));
await page.getByRole("button", { name: "Turn on" }).click();
await toast("Two-factor authentication is on");
const codes = await page.locator("li.font-mono, ul.font-mono li, ul li.rounded-lg").allInnerTexts();
const recovery = codes.map((c) => c.trim()).filter((c) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(c));
log(recovery.length === 10, `10 recovery codes are shown once (${recovery.length})`);

// sign out, then sign in again: password alone must not be enough
await page.getByRole("button", { name: "Account menu" }).or(page.locator('summary[aria-label="Account menu"]')).first().click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/admin/login");
await login(page);
await page.waitForURL("**/admin/login/verify", { timeout: 20000 });
log(true, "after the password, a two-factor step is required");
log((await get("/admin")).status === 307, "no session exists until the second factor is verified");
await page.getByLabel(/Authentication or recovery code/).fill("000000");
await page.getByRole("button", { name: /Verify and sign in/ }).click();
await page.getByText("That code is not correct").waitFor();
log(true, "a wrong code is rejected on the verify step");
await page.getByLabel(/Authentication or recovery code/).fill(totp(secret, Date.now() + 30000));
await page.getByRole("button", { name: /Verify and sign in/ }).click();
await page.waitForURL("**/admin", { timeout: 20000 });
log(true, "a valid authenticator code completes sign-in");

// recovery code: sign out, sign in with it once, and it cannot be reused
const rc = recovery[0];
await page.getByRole("button", { name: "Account menu" }).or(page.locator('summary[aria-label="Account menu"]')).first().click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/admin/login");
await login(page);
await page.waitForURL("**/admin/login/verify");
await page.getByLabel(/Authentication or recovery code/).fill(rc.toLowerCase());
await page.getByRole("button", { name: /Verify and sign in/ }).click();
await page.waitForURL("**/admin", { timeout: 20000 });
log(true, "a recovery code signs in");
await page.getByRole("button", { name: "Account menu" }).or(page.locator('summary[aria-label="Account menu"]')).first().click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/admin/login");
await login(page);
await page.waitForURL("**/admin/login/verify");
await page.getByLabel(/Authentication or recovery code/).fill(rc);
await page.getByRole("button", { name: /Verify and sign in/ }).click();
await page.getByText("That code is not correct").waitFor();
log(true, "the same recovery code cannot be used twice");
await page.getByLabel(/Authentication or recovery code/).fill(recovery[1]);
await page.getByRole("button", { name: /Verify and sign in/ }).click();
await page.waitForURL("**/admin", { timeout: 20000 });

// turn 2FA off again (leaves the throwaway account as it was)
await page.goto(BASE + "/admin/security", { waitUntil: "networkidle" });
const off = page.locator("form", { hasText: "Turn off two-factor authentication" });
await off.getByLabel("Password").fill(PW);
await off.getByLabel(/Authentication or recovery code/).fill(recovery[2]);
await off.getByRole("button", { name: "Turn off" }).click();
await toast("Two-factor authentication is off");
log(true, "2FA can be turned off with password + a recovery code");

// change password round trip is covered by unit tests; make sure the page itself reports mismatches
await page.getByLabel("Current password").fill(PW);
await page.getByLabel("New password", { exact: true }).fill("a-different-passphrase-1");
await page.getByLabel("Confirm new password").fill("something-else-entirely-2");
await page.getByRole("button", { name: "Change password" }).click();
await toast("do not match");
log(true, "mismatched new passwords are rejected");

log(errors.length === 0, `no browser console errors ${errors.slice(0, 2).join(" | ")}`);
await anon.context().close().catch(() => {});
await (await pwRequest.newContext()).dispose();
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
