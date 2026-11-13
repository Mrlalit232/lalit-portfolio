/**
 * SEO + indexability audit against a RUNNING build. No dependencies.
 *
 *   npm run build && npm start         (or any running instance)
 *   BASE_URL=http://localhost:3000 npm run test:seo
 *
 * BASE_URL        where the site is served (default http://localhost:3000)
 * EXPECT_ORIGIN   origin that canonical URLs must use (default: BASE_URL). Set it to your real
 *                 production origin when auditing a deployment.
 *
 * Exits non-zero on any failure, so it can gate CI.
 */
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGIN = (process.env.EXPECT_ORIGIN ?? BASE).replace(/\/$/, "");

let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
};
const get = async (path, init) => {
  const res = await fetch(BASE + path, { redirect: "manual", ...init });
  return { res, status: res.status, text: await res.text() };
};
const meta = (html, attr, name) => {
  const m = html.match(new RegExp(`<meta[^>]+${attr}="${name}"[^>]*content="([^"]*)"`, "i")) ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]*${attr}="${name}"`, "i"));
  return m ? m[1] : undefined;
};
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// ---- sitemap ----
const sm = await get("/sitemap.xml");
check(sm.status === 200 && /xml/.test(sm.res.headers.get("content-type") ?? ""), "sitemap.xml is served as XML");
const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(locs.length >= 8, `sitemap lists ${locs.length} URLs`);
check(new Set(locs).size === locs.length, "sitemap has no duplicate URLs");
check(locs.every((l) => l.startsWith(ORIGIN + "/") || l === ORIGIN), `every sitemap URL uses the expected origin ${ORIGIN}`);
check(!locs.some((l) => /\/admin|\/api|\/preview/.test(l)), "sitemap excludes admin, api and preview URLs");
check(locs.every((l) => !l.includes("?") && !l.includes("#")), "sitemap URLs have no query strings or fragments");

// ---- robots ----
const rb = await get("/robots.txt");
check(rb.status === 200, "robots.txt is served");
check(/Disallow:\s*\/admin/i.test(rb.text), "robots.txt disallows /admin");
check(/Allow:\s*\//i.test(rb.text), "robots.txt allows public content");
check(rb.text.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), "robots.txt references the sitemap on the expected origin");

// ---- per page ----
const titles = new Map();
const descriptions = new Map();
const internal = new Set();
for (const loc of locs) {
  const path = loc.slice(ORIGIN.length) || "/";
  const { status, text: html, res } = await get(path);
  const tag = path;
  check(status === 200, `${tag}: HTTP 200`);
  const title = decode((html.match(/<title>([^<]*)<\/title>/i) ?? [])[1] ?? "");
  const desc = decode(meta(html, "name", "description") ?? "");
  check(title.length >= 10 && title.length <= 65, `${tag}: title length ${title.length} ("${title}")`);
  check(desc.length >= 70 && desc.length <= 175, `${tag}: description length ${desc.length}`);
  if (titles.has(title)) check(false, `${tag}: duplicate title with ${titles.get(title)}`);
  titles.set(title, tag);
  if (descriptions.has(desc)) check(false, `${tag}: duplicate description with ${descriptions.get(desc)}`);
  descriptions.set(desc, tag);
  const canon = (html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i) ?? html.match(/<link[^>]+href="([^"]+)"[^>]*rel="canonical"/i) ?? [])[1];
  check(canon === loc, `${tag}: canonical matches sitemap URL (${canon})`);
  check(!/noindex/i.test(meta(html, "name", "robots") ?? "") && !/noindex/i.test(res.headers.get("x-robots-tag") ?? ""), `${tag}: indexable`);
  check(Boolean(meta(html, "property", "og:title") && meta(html, "property", "og:description") && meta(html, "property", "og:url")), `${tag}: Open Graph title/description/url`);
  check(Boolean(meta(html, "property", "og:image")), `${tag}: og:image present`);
  check(Boolean(meta(html, "name", "twitter:card")), `${tag}: twitter:card present`);
  check((html.match(/<h1[\s>]/g) ?? []).length === 1, `${tag}: exactly one <h1>`);
  check(/<html[^>]+lang="en"/i.test(html), `${tag}: html lang set`);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  check(imgs.every((i) => /\balt="/i.test(i)), `${tag}: all ${imgs.length} <img> have alt`);

  // structured data
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let parsed = [];
  try {
    parsed = blocks.map((b) => JSON.parse(b));
    check(true, `${tag}: ${blocks.length} JSON-LD block(s) parse`);
  } catch (e) {
    check(false, `${tag}: JSON-LD parse error ${e.message}`);
  }
  const types = parsed.map((p) => p["@type"]);
  check(types.filter((t) => t === "Person").length === 1 && types.filter((t) => t === "WebSite").length === 1, `${tag}: exactly one Person and one WebSite (no duplicates)`);
  if (path !== "/") check(types.includes("BreadcrumbList"), `${tag}: BreadcrumbList present`);
  if (path === "/" || path === "/about") check(types.includes("ProfilePage"), `${tag}: ProfilePage present`);
  if (path.startsWith("/projects/")) check(types.some((t) => t === "CreativeWork" || t === "SoftwareSourceCode"), `${tag}: project schema present`);
  check(!blocks.some((b) => /aggregateRating|"review"/i.test(b)), `${tag}: no rating/review schema`);

  for (const m of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"/g)) internal.add(m[1]);
}

// ---- internal links ----
const broken = [];
for (const href of internal) {
  if (href.startsWith("/_next") || href.startsWith("/admin")) continue;
  const r = await fetch(BASE + href, { redirect: "manual" });
  if (r.status >= 400) broken.push(`${href} -> ${r.status}`);
}
check(broken.length === 0, `internal links resolve (${internal.size} checked)${broken.length ? ": " + broken.join(", ") : ""}`);

// ---- 404 / private areas ----
for (const path of ["/definitely-not-a-page", "/projects/definitely-not-a-project"]) {
  const r = await get(path);
  check(r.status === 404, `${path} returns a real 404 (${r.status})`);
}
const login = await get("/admin/login");
check(/noindex/i.test(login.res.headers.get("x-robots-tag") ?? "") || /noindex/i.test(meta(login.text, "name", "robots") ?? ""), "/admin/login is noindex");
const adm = await get("/admin");
check([307, 308].includes(adm.status), "/admin redirects anonymous visitors");

const health = await get("/api/health");
let hj = {};
try { hj = JSON.parse(health.text); } catch {}
check(health.status === 200 && hj.status === "ok" && !("error" in hj), `health endpoint reports ok (${health.text.slice(0, 120)})`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
