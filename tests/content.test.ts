import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import type { DbHandle } from "@/db/client";
import { activityLog, contentItems } from "@/db/schema";
import { dataToValues, issuesToFieldErrors, valuesToData, rawValues } from "@/lib/content/codec";
import { entities } from "@/lib/content/registry";
import { seedContent } from "@/lib/content/seed";
import * as svc from "@/lib/content/service";
import { createAdminUser } from "@/lib/auth/users";
import { GOOD_PASSWORD, freshDb } from "./helpers";

let h: DbHandle;
let actor: string;
const project = entities.project;
const venture = entities.venture;
const testimonial = entities.testimonial;

const validProject = (over: Record<string, unknown> = {}) => ({
  slug: "demo-project",
  title: "Demo Project",
  category: "Web Platforms",
  tagline: "A demo",
  summary: "Summary text",
  status: "Draft build",
  featured: false,
  stack: ["React"],
  links: [{ label: "Live demo", href: "https://example.com" }],
  caseStudy: { overview: ["o"], objective: ["o"], solution: ["s"], role: ["r"], implementation: ["i"], implemented: ["x"], planned: [], future: [] },
  screenshots: [],
  ...over,
});

/** What the public site is allowed to see: published, not deleted, live `data` only. */
async function publicRows(type: string) {
  return h.db
    .select({ title: contentItems.title, data: contentItems.data })
    .from(contentItems)
    .where(and(eq(contentItems.type, type), eq(contentItems.status, "published"), isNull(contentItems.deletedAt)));
}

beforeAll(async () => {
  h = await freshDb();
  actor = (await createAdminUser(h.db, { email: "cms@example.com", password: GOOD_PASSWORD })).id;
});
afterAll(async () => {
  await h.close();
});

describe("form codec", () => {
  const fields = project.fields;
  it("round-trips structured data through form values", () => {
    const data = validProject({ caseStudy: { ...validProject().caseStudy, overview: ["First para", "Second para"] } });
    const values = dataToValues(fields, data);
    expect(values["caseStudy.overview"]).toBe("First para\n\nSecond para");
    expect(values.links).toBe("Live demo | https://example.com");
    const back = valuesToData(fields, values);
    expect((back.caseStudy as { overview: string[] }).overview).toEqual(["First para", "Second para"]);
    expect(back.links).toEqual([{ label: "Live demo", href: "https://example.com" }]);
    expect(back.stack).toEqual(["React"]);
  });
  it("keeps extra | characters in the last column and omits empty optional text", () => {
    const v = valuesToData(entities.skillGroup.fields, { id: "x", title: "T", blurb: "B", accent: "tech", skills: "A | Working knowledge | extra" });
    expect((v.skills as { name: string; level: string }[])[0]).toEqual({ name: "A", level: "Working knowledge | extra" });
    const e = valuesToData(entities.education.fields, { title: "BCA", issuer: "Uni", note: "" });
    expect("note" in e).toBe(false);
  });
  it("captures raw submitted values for refilling after errors", () => {
    const fd = new FormData();
    fd.set("title", "Hello");
    fd.set("featured", "on");
    const raw = rawValues(fields, fd);
    expect(raw.title).toBe("Hello");
    expect(raw.featured).toBe(true);
    expect(raw.slug).toBe("");
  });
  it("maps validation issues onto the owning field with a line number", () => {
    const parsed = project.schema.safeParse(validProject({ links: [{ label: "x", href: "javascript:alert(1)" }] }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = issuesToFieldErrors(fields, parsed.error.issues);
      expect(errors.links).toMatch(/^Line 1:/);
    }
  });
});

describe("validation rejects unsafe or invalid input", () => {
  it("blocks javascript: and other non-http(s) links, bad slugs and bad enums", async () => {
    const bad = await svc.createItem(h.db, project, actor, validProject({ links: [{ label: "x", href: "javascript:alert(1)" }] }));
    expect(bad.ok).toBe(false);
    const badSlug = await svc.createItem(h.db, project, actor, validProject({ slug: "Bad Slug!" }));
    expect(badSlug).toMatchObject({ ok: false });
    const badStage = await svc.createItem(h.db, venture, actor, { id: "v", name: "V", status: "s", stage: "launched", tagline: "t", summary: "s", listTitle: "l", items: [], note: "n" });
    expect(badStage.ok).toBe(false);
  });
});

describe("draft / publish lifecycle and public isolation", () => {
  let id: string;

  it("a new item is a private draft and not public", async () => {
    const r = await svc.createItem(h.db, project, actor, validProject());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    id = r.item.id;
    expect(r.item.status).toBe("draft");
    expect((await publicRows("project")).length).toBe(0);
  });

  it("publishing makes the live copy public", async () => {
    const r = await svc.publish(h.db, project, id, actor);
    expect(r.ok).toBe(true);
    const rows = await publicRows("project");
    expect(rows.map((x) => x.title)).toEqual(["Demo Project"]);
  });

  it("editing a published item changes only the draft; live stays unchanged until publish", async () => {
    const r = await svc.saveDraft(h.db, project, id, actor, validProject({ title: "Renamed Draft", tagline: "NEW TAGLINE" }));
    expect(r.ok).toBe(true);
    const live = await publicRows("project");
    expect(live[0].title).toBe("Demo Project");
    expect((live[0].data as { tagline: string }).tagline).toBe("A demo");
    const item = await svc.getItem(h.db, project, id);
    expect(item?.draft).not.toBeNull();
    expect(svc.workingCopy(item!).title).toBe("Renamed Draft");

    await svc.publish(h.db, project, id, actor);
    const after = await publicRows("project");
    expect(after[0].title).toBe("Renamed Draft");
    expect((await svc.getItem(h.db, project, id))?.draft).toBeNull();
  });

  it("discard draft restores the live version", async () => {
    await svc.saveDraft(h.db, project, id, actor, validProject({ title: "Throwaway", slug: "demo-project" }));
    const r = await svc.discardDraft(h.db, project, id, actor);
    expect(r.ok).toBe(true);
    expect((await publicRows("project"))[0].title).toBe("Renamed Draft");
  });

  it("unpublish removes it from the public view but keeps the content", async () => {
    const r = await svc.unpublish(h.db, project, id, actor);
    expect(r.ok).toBe(true);
    expect((await publicRows("project")).length).toBe(0);
    expect(svc.workingCopy((await svc.getItem(h.db, project, id))!).title).toBe("Renamed Draft");
    await svc.publish(h.db, project, id, actor);
    expect((await publicRows("project")).length).toBe(1);
  });

  it("archive hides it; unarchive returns it as a draft", async () => {
    await svc.setArchived(h.db, project, id, actor, true);
    expect((await publicRows("project")).length).toBe(0);
    await svc.setArchived(h.db, project, id, actor, false);
    expect((await svc.getItem(h.db, project, id))?.status).toBe("draft");
    await svc.publish(h.db, project, id, actor);
  });

  it("publish re-validates the working copy", async () => {
    const r = await svc.createItem(h.db, venture, actor, { id: "v1", name: "V1", status: "s", stage: "active", tagline: "t", summary: "s", listTitle: "l", items: [], note: "n" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await h.db.update(contentItems).set({ draft: { id: "v1" } }).where(eq(contentItems.id, r.item.id)); // corrupt the draft directly
    const p = await svc.publish(h.db, venture, r.item.id, actor);
    expect(p.ok).toBe(false);
    expect((await publicRows("venture")).length).toBe(0);
  });
});

describe("slugs, duplicate, trash, order", () => {
  it("rejects duplicate slugs on create, save and duplicate generates a unique one", async () => {
    const dup = await svc.createItem(h.db, project, actor, validProject({ title: "Other" }));
    expect(dup).toMatchObject({ ok: false });
    if (!dup.ok) expect(dup.fieldErrors?.slug).toMatch(/already used/);

    const [orig] = await publicRows("project");
    const [row] = await h.db.select().from(contentItems).where(eq(contentItems.title, orig.title));
    const c1 = await svc.duplicate(h.db, project, row.id, actor);
    const c2 = await svc.duplicate(h.db, project, row.id, actor);
    expect(c1.ok && c2.ok).toBe(true);
    if (c1.ok && c2.ok) {
      expect(c1.item.slug).toBe("demo-project-copy");
      expect(c2.item.slug).toBe("demo-project-copy-2");
      expect(c1.item.status).toBe("draft");
      expect(c1.item.title).toMatch(/\(copy\)$/);
    }
  });

  it("delete moves to trash (not public, recoverable); purge only works from trash", async () => {
    const r = await svc.createItem(h.db, testimonial, actor, { name: "A Person", designation: "Role", organization: "Org", text: "Genuine words." });
    if (!r.ok) throw new Error("setup");
    await svc.publish(h.db, testimonial, r.item.id, actor);
    expect((await publicRows("testimonial")).length).toBe(1);

    expect((await svc.purge(h.db, testimonial, r.item.id, actor)).ok).toBe(false); // not in trash yet
    expect((await svc.softDelete(h.db, testimonial, r.item.id, actor)).ok).toBe(true);
    expect((await publicRows("testimonial")).length).toBe(0);
    expect((await svc.listItems(h.db, testimonial, { status: "trash" })).length).toBe(1);
    expect((await svc.listItems(h.db, testimonial, { status: "all" })).length).toBe(0);

    expect((await svc.restore(h.db, testimonial, r.item.id, actor)).ok).toBe(true);
    expect((await publicRows("testimonial")).length).toBe(1);

    await svc.softDelete(h.db, testimonial, r.item.id, actor);
    expect((await svc.purge(h.db, testimonial, r.item.id, actor)).ok).toBe(true);
    expect(await svc.getItem(h.db, testimonial, r.item.id)).toBeNull();
  });

  it("a slug freed by deleting can be reused; restoring into a conflict is refused", async () => {
    const a = await svc.createItem(h.db, venture, actor, { id: "reuse-me", name: "A", status: "s", stage: "concept", tagline: "t", summary: "s", listTitle: "l", items: [], note: "n" });
    if (!a.ok) throw new Error("setup");
    await svc.softDelete(h.db, venture, a.item.id, actor);
    const b = await svc.createItem(h.db, venture, actor, { id: "reuse-me", name: "B", status: "s", stage: "concept", tagline: "t", summary: "s", listTitle: "l", items: [], note: "n" });
    expect(b.ok).toBe(true);
    const r = await svc.restore(h.db, venture, a.item.id, actor);
    expect(r.ok).toBe(false);
  });

  it("reorders by swapping neighbours and reports edges", async () => {
    const items = await svc.listItems(h.db, project);
    const first = items[0];
    const second = items[1];
    expect((await svc.move(h.db, project, second.id, actor, "up")).ok).toBe(true);
    const after = await svc.listItems(h.db, project);
    expect(after[0].id).toBe(second.id);
    expect(after[1].id).toBe(first.id);
    const edge = await svc.move(h.db, project, after[0].id, actor, "up");
    expect(edge.ok && edge.message).toBe("Already at the end.");
  });

  it("search finds by title and body, status filters work", async () => {
    expect((await svc.listItems(h.db, project, { q: "NEW TAGLINE" })).length).toBeGreaterThan(0); // published earlier, so live
    expect((await svc.listItems(h.db, project, { q: "Throwaway" })).length).toBe(0); // discarded draft is gone
    expect((await svc.listItems(h.db, project, { q: "renamed" })).length).toBeGreaterThan(0);
    expect((await svc.listItems(h.db, project, { q: "100%_" })).length).toBe(0); // LIKE wildcards are escaped
    expect((await svc.listItems(h.db, project, { status: "published" })).every((i) => i.status === "published")).toBe(true);
    expect((await svc.listItems(h.db, project, { status: "draft" })).every((i) => i.status === "draft")).toBe(true);
  });
});

describe("profile singleton", () => {
  it("creates on first save and edits through the same draft/publish flow", async () => {
    const data = {
      name: "Test Person", headline: "H", intro: "I", aboutEducation: "E", aboutParagraphs: ["p"], interests: ["x"],
      focusAreas: [{ id: "web", title: "Web", accent: "tech", body: "b" }],
      email: "test@example.com", location: "City", linkedin: "https://example.com/in/x", github: "https://github.com/x",
    };
    const r = await svc.saveSingleton(h.db, entities.profile, actor, data);
    expect(r.ok).toBe(true);
    const again = await svc.saveSingleton(h.db, entities.profile, actor, { ...data, headline: "H2" });
    expect(again.ok).toBe(true);
    expect((await h.db.select().from(contentItems).where(eq(contentItems.type, "profile"))).length).toBe(1);
    expect((await svc.softDelete(h.db, entities.profile, r.ok ? r.item.id : "", actor)).ok).toBe(false);
    const bad = await svc.saveSingleton(h.db, entities.profile, actor, { ...data, email: "not-an-email" });
    expect(bad).toMatchObject({ ok: false });
  });
});

describe("seeding the existing content", () => {
  it("imports everything as published, never seeds testimonials, and is idempotent / non-destructive", async () => {
    const fresh = await freshDb();
    const first = await seedContent(fresh.db);
    expect(first.created).toBeGreaterThan(15);
    const rows = await fresh.db.select().from(contentItems);
    expect(rows.every((r) => r.status === "published")).toBe(true);
    expect(rows.some((r) => r.type === "testimonial")).toBe(false);
    expect(rows.filter((r) => r.type === "project").map((r) => r.slug).sort()).toEqual(["bhim-coaching-center", "geniq", "personal-portfolio"]);
    expect(rows.filter((r) => r.type === "skillGroup").length).toBe(4);
    expect(rows.filter((r) => r.type === "education").length).toBe(1);
    expect(rows.filter((r) => r.type === "certification").length).toBe(6);

    // an admin edit must survive a re-seed
    const [p] = rows.filter((r) => r.type === "project" && r.slug === "geniq");
    await fresh.db.update(contentItems).set({ title: "EDITED BY ADMIN" }).where(eq(contentItems.id, p.id));
    const second = await seedContent(fresh.db);
    expect(second.created).toBe(0);
    const [again] = await fresh.db.select().from(contentItems).where(eq(contentItems.id, p.id));
    expect(again.title).toBe("EDITED BY ADMIN");
    await fresh.close();
  });
});

describe("audit trail", () => {
  it("records content actions without leaking content bodies", async () => {
    const logs = await h.db.select().from(activityLog);
    const actions = new Set(logs.map((l) => l.action));
    for (const a of ["project.create", "project.publish", "project.unpublish", "project.discard", "testimonial.delete", "testimonial.purge", "project.reorder"]) expect(actions.has(a)).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("Genuine words.");
  });
});
