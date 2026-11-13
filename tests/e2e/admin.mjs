import { ADMIN_EMAIL, BASE, PW, launch, requirePassword } from "./_env.mjs";
requirePassword();

const EMAIL = ADMIN_EMAIL;
const COOKIE = "__Host-session";
const results = [];
const log = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };

const browser = await launch();
const newPage = async () => (await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage());

// 1. unauthenticated access
{
  const r = await fetch(BASE + "/admin", { redirect: "manual" });
  log([307, 308].includes(r.status) && r.headers.get("location")?.endsWith("/admin/login"), `GET /admin without cookie -> ${r.status} ${r.headers.get("location")}`);
  const r2 = await fetch(BASE + "/admin/login");
  log(r2.headers.get("cache-control")?.includes("no-store"), "admin responses are no-store");
  log(r2.headers.get("x-robots-tag")?.includes("noindex"), "admin sends X-Robots-Tag noindex");
  log(r2.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), "admin sends CSP frame-ancestors none");
  log(r2.headers.get("x-frame-options") === "DENY" && r2.headers.get("x-content-type-options") === "nosniff", "security headers present");
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  log(/Disallow: \/admin/.test(robots), "robots.txt disallows /admin");
  const html = await r2.text();
  log(/noindex/.test(html), "login page has noindex meta");
}

// 2. forged / garbage cookie must not reveal protected content
{
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: COOKIE, value: "garbage-token", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
  const p = await ctx.newPage();
  await p.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await p.waitForURL("**/admin/login", { timeout: 15000 }).catch(() => {});
  const body = await p.content();
  log(p.url().endsWith("/admin/login") && !body.includes("Authenticated as"), `forged cookie -> ${p.url()} and no protected content`);
  await ctx.close();
}

// 3. wrong credentials: generic message, identical for unknown account
{
  const p = await newPage();
  await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await p.getByLabel("Email").fill(EMAIL);
  await p.getByLabel("Password").fill("definitely-wrong-password");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.getByText("Incorrect email or password.").waitFor();
  const a = await p.getByRole("alert").first().innerText();
  await p.getByLabel("Email").fill("nobody@example.test");
  await p.getByLabel("Password").fill("definitely-wrong-password");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForTimeout(1500);
  const b = await p.getByText("Incorrect email or password.").count();
  log(a.includes("Incorrect email or password.") && b === 1, "wrong password and unknown account give the same generic message");
  log(p.url().endsWith("/admin/login"), "stays on login after failure");
}

// 4. successful login, cookie flags, protected page, replay after logout
let stolenToken;
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await p.getByLabel("Email").fill(EMAIL);
  await p.getByLabel("Password").fill(PW);
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/admin", { timeout: 20000 });
  await p.getByText(EMAIL).waitFor({ timeout: 15000 }).catch(() => {});
  log(await p.getByText(EMAIL).count() > 0, "valid login reaches /admin and shows the signed-in user");
  const cookies = await ctx.cookies();
  const c = cookies.find((x) => x.name === COOKIE);
  stolenToken = c?.value;
  log(Boolean(c) && c.httpOnly === true && c.secure === true && c.sameSite === "Lax" && c.path === "/", `session cookie flags httpOnly=${c?.httpOnly} sameSite=${c?.sameSite} path=${c?.path}`);
  log(!(await p.evaluate(() => document.cookie)).includes("session="), "cookie is not readable from JavaScript");
  // already signed in -> login page redirects
  await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await p.waitForURL("**/admin", { timeout: 15000 }).catch(() => {});
  log(p.url().endsWith("/admin"), "signed-in user is redirected away from /admin/login");
  // logout
  await p.locator('summary[aria-label="Account menu"]').click();
  await p.getByRole("button", { name: "Sign out" }).click();
  await p.waitForURL("**/admin/login", { timeout: 15000 });
  log(p.url().endsWith("/admin/login"), "logout returns to login");
  log(!(await ctx.cookies()).some((x) => x.name === COOKIE && x.value), "logout clears the cookie");
  await ctx.close();

  // replay the old token: must be rejected server-side
  const ctx2 = await browser.newContext();
  await ctx2.addCookies([{ name: COOKIE, value: stolenToken, domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await p2.waitForURL("**/admin/login", { timeout: 15000 }).catch(() => {});
  log(p2.url().endsWith("/admin/login") && !(await p2.content()).includes("Authenticated as"), "revoked session token is rejected after logout");
  await ctx2.close();
}

// 5. lockout (separate account so the earlier steps are unaffected)
{
  const p = await newPage();
  await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  let locked = false;
  for (let i = 0; i < 8 && !locked; i++) {
    await p.getByLabel("Email").fill("lockout-target@example.test");
    await p.getByLabel("Password").fill(`wrong-${i}`);
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForTimeout(900);
    locked = (await p.getByText(/Too many failed attempts/).count()) > 0;
  }
  log(locked, "repeated failures trigger the lockout message");
}

await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
