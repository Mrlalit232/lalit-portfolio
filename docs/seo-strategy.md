# SEO strategy and technical notes

Goal: be found for **Lalit Kumar Saini** first, and credibly for the professional areas he genuinely works in.
Nothing here promises rankings or rich results, and no search volume or difficulty figures are quoted: none were
measured. Validate with Google Search Console (impressions and queries) after launch.

## Keyword map (one primary target per page, no stuffing)

| Page | Primary keyword | Secondary / long-tail | Intent |
|---|---|---|---|
| `/` | Lalit Kumar Saini (portfolio) | Lalit Kumar Saini developer, web developer and QA portfolio | Branded / navigational |
| `/about` | Lalit Kumar Saini BCA student | Lalit Saini Gurugram, web and QA background | Branded / informational |
| `/skills` | Software testing portfolio | QA tester portfolio, Python automation (learning), manual testing, test case design, web developer skills | Professional opportunity |
| `/projects` | Web development projects | software testing projects, Next.js portfolio projects | Professional opportunity |
| `/projects/[slug]` | The project name (e.g. GenIQ) | Technology-specific long-tail from the real stack | Informational / hiring |
| `/experience` | Sales marketing operations experience | Red Hills Group, campus ambassador | Professional opportunity |
| `/services` | Website development services | business websites, landing pages, portfolio websites | Commercial (client) |
| `/ventures` | Entrepreneurship ventures | website development business | Informational |
| `/contact`, `/resume` | Contact Lalit Kumar Saini | hire web developer / QA tester, resume download | Transactional |

Honesty rules: Python and test automation are labelled "Learning & practising" on the site, so they are targeted as
*learning/practising* topics, not as senior expertise. Generic terms ("QA automation portfolio") are very competitive;
the realistic early wins are branded queries and specific project/technology long-tail queries.

## What is implemented

- **Metadata** per page via `buildMetadata()` in `lib/seo.ts`: unique title and description (descriptions are clipped
  to 160 characters at a word boundary), canonical URL, Open Graph (including `og:image`), Twitter card, `noindex` only
  where asked. Project pages generate metadata from the published case study.
- **Sitemap** (`app/sitemap.ts`): public pages and published case studies only; configurable origin; no admin, API or
  preview URLs. `lastmod` is intentionally omitted because the content layer does not expose a verified modified date.
- **robots.txt** (`app/robots.ts`): allows public content, disallows `/admin`, `/preview`, `/api`, references the sitemap.
  This is not a security control; the admin is protected by authentication and `noindex` headers.
- **Structured data** (JSON-LD, verified facts only): `Person` (with `sameAs` for GitHub and LinkedIn, stable `@id`),
  `WebSite`, `ProfilePage` (home, about), `BreadcrumbList` (every inner page), and per project `SoftwareSourceCode`
  (when a GitHub repository link exists) or `CreativeWork`. No reviews, ratings or organisation are claimed.
- **Breadcrumbs** (visible and structured) and a "Keep exploring" block with descriptive internal links on the main pages.
- **Canonical consistency**: one origin from `NEXT_PUBLIC_SITE_URL`, no trailing slash, no query strings in the sitemap.
  Real HTTP 404 for unknown URLs, including unknown project slugs.
- **Core Web Vitals work**: the animation library (Motion) was removed. Route transitions, the hero entrance and
  scroll reveals are CSS-only (scroll reveals use `animation-timeline: view()` and simply show the content in browsers
  without support), so no content waits for JavaScript. Reveals only slide (no opacity change), so text is always
  contrast-compliant. Off-screen sections use `content-visibility: auto`. Fonts via `next/font` (self-hosted).
- **Automated checks**: `npm run test:seo` (see README) audits all of the above against a running build.

## Managing SEO from the admin

Admin, SEO lets the owner override, per public page, the title, meta description, social sharing image (an uploaded file)
and `noindex`, plus a fallback description and default social image. Overrides flow through `pageMetadata()` into
`generateMetadata`, so they appear in the real `<head>` and in Open Graph and Twitter tags; a page marked `noindex` also
disappears from `sitemap.xml`. Case studies use their own title and summary (edited with the project). Admin, Redirects
manages 301/302/307/308 redirects and creates one automatically when a published project's URL changes.

## Case-study metadata (resolved)

Case studies used to resolve metadata per request, which made Next.js stream `<title>` and `<meta>` into the page
body for ordinary browsers (crawlers on Next's list received them in `<head>`). Forcing head metadata for every client
with `htmlLimitedBots: /.*/` was tried and **broke link prefetching**, so it was rejected.

The fix is structural: `generateStaticParams()` prerenders every published case study, so their metadata is part of
the static `<head>` for every client (browser, Googlebot, Bing, LinkedIn). A case study published after a build renders on
demand and is then cached. `proxy.ts` returns a real 404 for slugs that are not published, so a "not found" result is never
cached for a slug that is about to be published. This is verified by `tests/e2e/cms.mjs` (draft -> 404, publish -> 200,
unpublish -> 404) and by the SEO audit (metadata present for plain-browser, Googlebot and LinkedIn user agents).

## Search Console and Bing readiness (not done; needs your accounts and a live domain)

1. Deploy, set `NEXT_PUBLIC_SITE_URL` to the final domain, redeploy.
2. Google Search Console: add the domain property, verify via DNS TXT (or the HTML-tag method), then Sitemaps ->
   submit `https://<domain>/sitemap.xml`. Use URL Inspection on `/`, `/projects` and one case study.
3. Bing Webmaster Tools: import the site from Search Console, or verify separately, and submit the same sitemap.
4. Optional analytics: none is installed (privacy and cost); add one only when wanted.
5. Run `EXPECT_ORIGIN=https://<domain> BASE_URL=https://<domain> npm run test:seo` against production.

## Future (not built, to avoid thin or filler content)

A short technical blog or per-project write-ups (what was tested, how, what was learned) would build genuine topical
authority for QA and automation. Add only when there is real material to publish.
