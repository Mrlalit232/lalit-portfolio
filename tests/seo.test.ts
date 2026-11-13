import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, buildMetadata, clipDescription, jsonLdString, personJsonLd, profilePageJsonLd, projectJsonLd, websiteJsonLd } from "@/lib/seo";

describe("clipDescription", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(clipDescription("  hello \n  world ")).toBe("hello world");
  });
  it("clips long text at a word boundary within the limit", () => {
    const text = "word ".repeat(80);
    const out = clipDescription(text, 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});

describe("buildMetadata", () => {
  const m = buildMetadata({ title: "Skills", description: "d".repeat(100), path: "/skills" });
  it("sets a canonical, Open Graph image and Twitter image", () => {
    expect(String(m.alternates?.canonical)).toMatch(/\/skills$/);
    expect(JSON.stringify(m.openGraph)).toContain("/opengraph-image");
    expect(JSON.stringify(m.twitter)).toContain("/opengraph-image");
  });
  it("only noindexes when asked", () => {
    expect(m.robots).toBeUndefined();
    expect(buildMetadata({ title: "x", description: "y", path: "/p", noindex: true }).robots).toMatchObject({ index: false });
  });
});

describe("structured data", () => {
  it("person links verified profiles and has a stable @id shared by the other types", () => {
    expect(personJsonLd["@id"]).toMatch(/#person$/);
    expect(personJsonLd.sameAs.length).toBeGreaterThanOrEqual(2);
    expect(websiteJsonLd.publisher["@id"]).toBe(personJsonLd["@id"]);
    expect(profilePageJsonLd("/about", "About").mainEntity["@id"]).toBe(personJsonLd["@id"]);
  });
  it("never emits ratings or reviews", () => {
    const all = JSON.stringify([personJsonLd, websiteJsonLd, profilePageJsonLd("/", "x")]);
    expect(all).not.toMatch(/aggregateRating|"review"/);
  });
  it("breadcrumbs are numbered from 1 with absolute URLs", () => {
    const b = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Projects", path: "/projects" }]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toMatch(/^https?:\/\/.+\/projects$/);
  });
  it("a project with a GitHub repository is SoftwareSourceCode, otherwise CreativeWork", () => {
    const base = { slug: "a", title: "A", summary: "s", stack: ["TypeScript"] };
    expect(projectJsonLd({ ...base, links: [{ label: "Repo", href: "https://github.com/x/y" }] })["@type"]).toBe("SoftwareSourceCode");
    expect(projectJsonLd({ ...base, links: [{ label: "Live", href: "https://example.com" }] })["@type"]).toBe("CreativeWork");
  });
  it("escapes '<' so content can never close the script tag", () => {
    const out = jsonLdString({ a: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).a).toBe("</script><script>alert(1)</script>");
  });
});
