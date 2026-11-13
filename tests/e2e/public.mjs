import { BASE, launch } from "./_env.mjs";

const SHOTS = process.argv[2];
const routes = ["/", "/about", "/experience", "/projects", "/projects/geniq", "/projects/bhim-coaching-center", "/projects/personal-portfolio", "/skills", "/services", "/ventures", "/resume", "/contact", "/nope"];
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const results = [];
const log = (ok, msg) => { results.push([ok, msg]); console.log(ok ? "PASS" : "FAIL", msg); };

const browser = await launch();

// 1. every route x width: console errors, overflow, h1 count, images alt
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const r of routes) {
    errors.length = 0;
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1: document.querySelectorAll("h1").length,
      noAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
      unlabeled: [...document.querySelectorAll("input:not([type=hidden]):not([name=website]),textarea,select")].filter((e) => !e.labels?.length).length,
    }));
    log(info.overflow <= 0, `${w}px ${r} overflow=${info.overflow}`);
    if (r !== "/nope") log(info.h1 === 1, `${w}px ${r} h1=${info.h1}`);
    log(info.noAlt === 0 && info.unlabeled === 0, `${w}px ${r} img-alt/labels ok`);
    // The browser itself logs the HTTP 404 resource error on the deliberate 404 route; that is expected, not a bug.
    const real = r === "/nope" ? errors.filter((e) => !/status of 404/.test(e)) : errors;
    log(real.length === 0, `${w}px ${r} console errors: ${real.join(" | ").slice(0, 200)}`);
    if (SHOTS && (w === 375 || w === 1280) && ["/ventures"].includes(r)) {
      await page.screenshot({ path: `${SHOTS}/${w}${r.replace(/\//g, "_") || "_home"}.png`, fullPage: true });
    }
  }
  await ctx.close();
}

// 2. mobile nav keyboard
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: "Open menu" });
  await btn.click();
  log(await page.getByRole("navigation", { name: "Mobile" }).isVisible(), "mobile menu opens");
  log((await page.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")) === "true", "aria-expanded true");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  log(!(await page.getByRole("navigation", { name: "Mobile" }).isVisible().catch(() => false)), "Escape closes menu");
  log(await page.getByRole("button", { name: "Open menu" }).evaluate((e) => e === document.activeElement), "focus returns to toggle");
  await btn.click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Skills" }).click();
  await page.waitForURL("**/skills");
  await page.waitForTimeout(400);
  log(!(await page.getByRole("navigation", { name: "Mobile" }).isVisible().catch(() => false)), "menu closes after navigation");
  await ctx.close();
}

// 3. desktop nav active state + skip link
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/projects/geniq", { waitUntil: "networkidle" });
  const cur = await page.locator('nav[aria-label="Primary"] a[aria-current="page"]').allTextContents();
  log(cur.length === 1 && cur[0] === "Projects", `active nav on case study = ${cur}`);
  await page.keyboard.press("Tab");
  log(await page.getByRole("link", { name: "Skip to content" }).isVisible(), "skip link appears on first Tab");
  await ctx.close();
}

// 4. project filters
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/projects", { waitUntil: "networkidle" });
  const count = () => page.locator("ul >> article").count();
  log((await count()) === 3, "projects: 3 cards for All");
  await page.getByRole("button", { name: /AI & Software/ }).click();
  log((await count()) === 1, "filter AI & Software -> 1");
  await page.getByRole("button", { name: /Web Platforms/ }).click();
  log((await count()) === 1, "filter Web Platforms -> 1");
  await ctx.close();
}

// 5. contact form
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/contact?type=project", { waitUntil: "networkidle" });
  log((await page.getByLabel("What is this about?").inputValue()) === "project", "contact ?type=project preselects");
  await page.waitForTimeout(3300);
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByText('Please fix the highlighted fields.').waitFor();
  log((await page.locator("form [id$='-name-err']").count()) === 1 && (await page.locator("form [id$='-message-err']").count()) === 1, "empty submit shows field errors");
  log((await page.getByLabel("Your name").getAttribute("aria-invalid")) === "true", "aria-invalid set");
  await page.getByLabel("Your name").fill("Test User");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Message").fill("short");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(800);
  log((await page.getByLabel("Your name").inputValue()) === "Test User", "values preserved after error");
  log((await page.locator("form [id$='-email-err']").count()) === 1, "invalid email error");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Message").fill("This is a valid test message for QA purposes.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(1200);
  const txt = await page.locator("form").first().innerText().catch(() => "");
  const success = await page.getByText("Message sent").count();
  log(success === 0 && /not configured/i.test(txt), "no provider => honest 'not configured' state, no fake success");
  await ctx.close();
}

// 5b. content corrections
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const body = async (p) => { await page.goto(BASE + p, { waitUntil: "networkidle" }); return page.locator("main").evaluate((m) => m.textContent ?? ""); }; // textContent: includes off-screen sections that content-visibility:auto skips for innerText
  let t = await body("/projects/geniq");
  log(t.includes("Team Leader & Project Developer"), "GenIQ role corrected");
  log(!/Challenges/i.test(t), "GenIQ has no Challenges section");
  t = await body("/projects/bhim-coaching-center");
  log(t.includes("Frontend Developer") && !/Challenges/i.test(t), "BHIM role corrected, no Challenges");
  t = await body("/projects/personal-portfolio");
  log(!/Challenges/i.test(t), "Portfolio has no Challenges section");
  const nums = await page.locator("main h2[id^='s-']").evaluateAll((e) => e.map((x) => x.id.slice(2)));
  log(nums.join() === nums.map((_, i) => String(i + 1).padStart(2, "0")).join(), `case-study numbering sequential: ${nums}`);
  t = await body("/experience");
  log(t.includes("Heridudu Campus Ambassador") && !/verified/i.test(t), "Heridudu: no placeholder text");
  t = await body("/ventures");
  for (const k of ["Website Development Business", "Early-stage / In progress", "Business Solutions Platform", "Concept / Planning", "8–24 hours", "15–30%", "Business Collaboration Ecosystem", "Exploration / Concept", "not an operational platform"]) log(t.includes(k), `ventures shows: ${k}`);
  log(!/revenue|customers/i.test(t.replace(/no claims of revenue or customers/, "")), "ventures makes no revenue/customer claims");
  t = await body("/");
  log(t.includes("Building toward businesses."), "home has ventures preview");
  log((await page.getByRole("heading", { name: "Building toward businesses." }).count()) === 1, "ventures preview appears once on home");
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(BASE + "/ventures", { waitUntil: "networkidle" });
  log(await page.getByRole("button", { name: "Open menu" }).isVisible(), "1024px uses mobile menu (nav fits)");
  await page.setViewportSize({ width: 1280, height: 800 });
  const cur = await page.locator('nav[aria-label="Primary"] a[aria-current="page"]').allTextContents();
  log(cur.join() === "Ventures", `desktop nav active = ${cur}`);
  const sm = await (await fetch(BASE + "/sitemap.xml")).text();
  log(sm.includes("/ventures"), "sitemap includes /ventures");
  await ctx.close();
}

// 6. reduced motion: content visible
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const op = await page.evaluate(() => getComputedStyle(document.querySelector("main > div") ?? document.body).opacity);
  log(op === "1", `reduced-motion content opacity=${op}`);
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r[0]);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
