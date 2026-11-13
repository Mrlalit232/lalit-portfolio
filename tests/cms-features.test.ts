import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/db/client";
import { contentItems, redirects, users } from "@/db/schema";
import { entities } from "@/lib/content/registry";
import * as svc from "@/lib/content/service";
import { listRevisions, MAX_REVISIONS } from "@/lib/content/revisions";
import { bulkOperate } from "@/lib/content/bulk";
import { createPreviewLink, resolvePreview, revokePreviewLinks } from "@/lib/content/preview";
import { activeRedirectMap, createRedirect, deleteRedirect, listRedirects, normalizeInternalPath, updateRedirect } from "@/lib/redirects";
import { getSeoSettings, saveSeoSettings } from "@/lib/settings";
import { deleteMedia, mediaUsage, sanitizeFilename, saveUpload, sniffType, MEDIA_MAX_BYTES } from "@/lib/media";
import { deleteMessage, listMessages, setMessageStatus, storeMessage, unreadCount } from "@/lib/messages";
import { isCountablePath, isCountableRequest, recordView, summarize } from "@/lib/analytics";
import { createAdminUser } from "@/lib/auth/users";
import { GOOD_PASSWORD, freshDb } from "./helpers";

let h: DbHandle;
let actor: string;
const project = entities.project;

const validProject = (over: Record<string, unknown> = {}) => ({
  slug: "feature-project",
  title: "Feature Project",
  category: "Web",
  tagline: "t",
  summary: "s",
  status: "Draft",
  featured: false,
  stack: ["TypeScript"],
  links: [],
  caseStudy: { overview: ["o"], objective: ["o"], solution: ["s"], role: ["r"], implementation: ["i"], implemented: ["x"], planned: [], future: [] },
  screenshots: [],
  ...over,
});

const created = async (over: Record<string, unknown> = {}) => {
  const res = await svc.createItem(h.db, project, actor, validProject(over));
  if (!res.ok) throw new Error(JSON.stringify(res));
  return res.item;
};

beforeAll(async () => {
  h = await freshDb();
  actor = (await createAdminUser(h.db, { email: "owner@example.com", password: GOOD_PASSWORD })).id;
});
afterAll(async () => {
  await h.close();
});

describe("revision history", () => {
  it("records a snapshot on save and publish, newest first, and restores one as a DRAFT", async () => {
    const item = await created({ slug: "rev-1", title: "Rev One" });
    await svc.saveDraft(h.db, project, item.id, actor, validProject({ slug: "rev-1", title: "Rev One v2" }));
    await svc.publish(h.db, project, item.id, actor);
    const revs = await listRevisions(h.db, item.id);
    expect(revs.map((r) => r.reason)).toEqual(["publish", "save", "save"]);
    expect(revs[0].version).toBeGreaterThan(revs[2].version);

    const first = revs[revs.length - 1];
    const res = await svc.restoreRevision(h.db, project, item.id, first.id, actor);
    expect(res.ok).toBe(true);
    const [row] = await h.db.select().from(contentItems).where(eq(contentItems.id, item.id));
    expect(row.status).toBe("published"); // restoring never changes what is live
    expect((row.data as { title: string }).title).toBe("Rev One v2");
    expect((row.draft as { title: string }).title).toBe("Rev One"); // restored into the draft only
    expect((await listRevisions(h.db, item.id))[0].reason).toBe("restore");
  });

  it("rejects a revision id from another item", async () => {
    const a = await created({ slug: "rev-a", title: "A" });
    const b = await created({ slug: "rev-b", title: "B" });
    const [rb] = await listRevisions(h.db, b.id);
    expect((await svc.restoreRevision(h.db, project, a.id, rb.id, actor)).ok).toBe(false);
  });

  it("keeps only the most recent revisions", async () => {
    const item = await created({ slug: "rev-cap", title: "Cap" });
    for (let i = 0; i < MAX_REVISIONS + 5; i++) await svc.saveDraft(h.db, project, item.id, actor, validProject({ slug: "rev-cap", title: `Cap ${i}` }));
    expect((await listRevisions(h.db, item.id)).length).toBe(MAX_REVISIONS);
  });
});

describe("scheduled publishing", () => {
  it("refuses past times, schedules a draft, and publishDue only publishes what is due", async () => {
    const item = await created({ slug: "sched-1", title: "Scheduled" });
    expect((await svc.schedulePublish(h.db, project, item.id, actor, new Date(Date.now() - 1000))).ok).toBe(false);
    const future = new Date(Date.now() + 3_600_000);
    expect((await svc.schedulePublish(h.db, project, item.id, actor, future)).ok).toBe(true);

    expect((await svc.publishDue(h.db, new Date())).changed).toEqual([]); // not due yet
    const [still] = await h.db.select().from(contentItems).where(eq(contentItems.id, item.id));
    expect(still.status).toBe("draft");

    const out = await svc.publishDue(h.db, new Date(future.getTime() + 1000));
    expect(out.changed).toContain("project");
    const [live] = await h.db.select().from(contentItems).where(eq(contentItems.id, item.id));
    expect(live.status).toBe("published");
    expect(live.publishAt).toBeNull();
    expect((await svc.publishDue(h.db, new Date(future.getTime() + 2000))).changed).toEqual([]); // idempotent
  });

  it("can be cancelled, and a trashed item is never published", async () => {
    const a = await created({ slug: "sched-cancel", title: "Cancel" });
    await svc.schedulePublish(h.db, project, a.id, actor, new Date(Date.now() + 3_600_000));
    expect((await svc.schedulePublish(h.db, project, a.id, actor, null)).ok).toBe(true);
    const b = await created({ slug: "sched-trash", title: "Trash" });
    await svc.schedulePublish(h.db, project, b.id, actor, new Date(Date.now() + 3_600_000));
    await svc.softDelete(h.db, project, b.id, actor);
    await svc.publishDue(h.db, new Date(Date.now() + 7_200_000));
    const [bRow] = await h.db.select().from(contentItems).where(eq(contentItems.id, b.id));
    expect(bRow.status).toBe("draft");
  });
});

describe("preview links", () => {
  it("resolves a valid token to the item, and rejects expired, revoked, unknown and malformed tokens", async () => {
    const item = await created({ slug: "prev-1", title: "Preview Me" });
    const link = await createPreviewLink(h.db, item.id, actor, 1);
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect((await resolvePreview(h.db, link.token))?.item.id).toBe(item.id);
    expect(await resolvePreview(h.db, "x".repeat(40))).toBeNull();
    expect(await resolvePreview(h.db, "bad token!")).toBeNull();

    await revokePreviewLinks(h.db, item.id, actor);
    expect(await resolvePreview(h.db, link.token)).toBeNull();

    const second = await createPreviewLink(h.db, item.id, actor, 1);
    if (!second.ok) throw new Error("link");
    await svc.softDelete(h.db, project, item.id, actor);
    expect(await resolvePreview(h.db, second.token)).toBeNull(); // trashed items are not previewable
  });

  it("does not create links for types without a preview page", async () => {
    const t = await svc.createItem(h.db, entities.education, actor, { title: "BCA", issuer: "College", note: "n" });
    if (!t.ok) throw new Error("edu");
    expect((await createPreviewLink(h.db, t.item.id, actor)).ok).toBe(false);
  });
});

describe("bulk actions", () => {
  it("applies the operation to many items and reports individual failures", async () => {
    const a = await created({ slug: "bulk-a", title: "Bulk A" });
    const b = await created({ slug: "bulk-b", title: "Bulk B" });
    const out = await bulkOperate(h.db, project, [a.id, b.id, "00000000-0000-4000-8000-000000000000", a.id], "publish", actor);
    expect(out.done).toBe(2); // duplicate id counted once
    expect(out.failed).toHaveLength(1);
    const out2 = await bulkOperate(h.db, project, [a.id, b.id], "delete", actor);
    expect(out2.done).toBe(2);
    expect((await bulkOperate(h.db, project, [a.id], "purge", actor)).done).toBe(1);
    expect((await bulkOperate(h.db, project, [b.id], "unpublish", actor)).failed).toHaveLength(1); // trashed: cannot unpublish
  });
});

describe("redirects", () => {
  it("normalises and validates paths (no external hosts, reserved areas, loops or self-redirects)", async () => {
    expect(normalizeInternalPath("/old/")).toBe("/old");
    expect(normalizeInternalPath("//evil.com")).toBeNull();
    expect(normalizeInternalPath("https://evil.com")).toBeNull();
    expect(normalizeInternalPath("/a b")).toBeNull();
    expect((await createRedirect(h.db, actor, { fromPath: "/admin/x", toPath: "/y" })).ok).toBe(false);
    expect((await createRedirect(h.db, actor, { fromPath: "/api/x", toPath: "/y" })).ok).toBe(false);
    expect((await createRedirect(h.db, actor, { fromPath: "/same", toPath: "/same" })).ok).toBe(false);
    expect((await createRedirect(h.db, actor, { fromPath: "/x", toPath: "/y", status: 418 })).ok).toBe(false);
    expect((await createRedirect(h.db, actor, { fromPath: "/", toPath: "/y" })).ok).toBe(false);
    expect((await createRedirect(h.db, actor, { fromPath: "/ext", toPath: "http://insecure.example" })).ok).toBe(false);
  });

  it("creates, updates, deletes, blocks duplicates and loops, and exposes only enabled redirects", async () => {
    expect((await createRedirect(h.db, actor, { fromPath: "/old-a", toPath: "/new-a", status: 301 })).ok).toBe(true);
    expect((await createRedirect(h.db, actor, { fromPath: "/old-a", toPath: "/other" })).ok).toBe(false); // duplicate
    expect((await createRedirect(h.db, actor, { fromPath: "/new-a", toPath: "/old-a" })).ok).toBe(false); // direct loop
    expect((await createRedirect(h.db, actor, { fromPath: "/b", toPath: "https://example.com/x", status: 302 })).ok).toBe(true);
    const rows = await listRedirects(h.db);
    const a = rows.find((r) => r.fromPath === "/old-a")!;
    expect((await updateRedirect(h.db, actor, a.id, { fromPath: "/old-a", toPath: "/new-a2", enabled: false })).ok).toBe(true);
    expect(Object.keys(await activeRedirectMap(h.db))).not.toContain("/old-a");
    expect(await deleteRedirect(h.db, actor, a.id)).toBe(true);
  });

  it("changing a PUBLISHED project's slug adds an automatic redirect from the old URL", async () => {
    const item = await created({ slug: "slug-old", title: "Slug Mover" });
    await svc.publish(h.db, project, item.id, actor);
    await svc.saveDraft(h.db, project, item.id, actor, validProject({ slug: "slug-new", title: "Slug Mover" }));
    expect((await svc.publish(h.db, project, item.id, actor)).ok).toBe(true);
    const map = await activeRedirectMap(h.db);
    expect(map["/projects/slug-old"]).toEqual({ to: "/projects/slug-new", status: 301 });
    const [auto] = await h.db.select().from(redirects).where(eq(redirects.fromPath, "/projects/slug-old"));
    expect(auto.auto).toBe(true);
  });
});

describe("SEO settings", () => {
  it("saves, strips empty values, and rejects markup and unknown pages", async () => {
    const ok = await saveSeoSettings(h.db, actor, { defaultDescription: "  A plain description  ", pages: { "/about": { title: "About me", description: "", noindex: false } } });
    expect(ok.ok).toBe(true);
    expect(await getSeoSettings(h.db)).toEqual({ defaultDescription: "A plain description", pages: { "/about": { title: "About me" } } });
    expect((await saveSeoSettings(h.db, actor, { pages: { "/about": { title: "<script>alert(1)</script>" } } })).ok).toBe(false);
    expect((await saveSeoSettings(h.db, actor, { pages: { "/nope": { title: "x" } } })).ok).toBe(false);
    expect((await saveSeoSettings(h.db, actor, { pages: { "/about": { ogImage: "not-a-uuid" } } })).ok).toBe(false);
  });
});

describe("media", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const pdf = new TextEncoder().encode("%PDF-1.4\n%test");

  it("detects types from magic bytes and ignores the claimed name", () => {
    expect(sniffType(png)).toBe("png");
    expect(sniffType(pdf)).toBe("pdf");
    expect(sniffType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>"))).toBeNull();
    expect(sniffType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffType(new Uint8Array(0))).toBeNull();
  });

  it("sanitises filenames", () => {
    expect(sanitizeFilename("../../etc/passwd", "png")).toBe("passwd.png");
    expect(sanitizeFilename("My Résumé (final).pdf", "pdf")).toMatch(/^[\w.-]+\.pdf$/);
    expect(sanitizeFilename("<script>.png", "png")).not.toMatch(/[<>]/);
  });

  it("stores valid files, rejects disguised and oversized ones, and never deletes a file that is in use", async () => {
    const up = await saveUpload(h.db, actor, { filename: "../shot.exe", bytes: png, alt: "<b>Shot</b>" });
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.row.mime).toBe("image/png");
    expect(up.row.filename).toBe("shot.png"); // extension comes from the verified type
    expect(up.row.alt).not.toContain("<");

    expect((await saveUpload(h.db, actor, { filename: "evil.png", bytes: new TextEncoder().encode("<svg onload=alert(1)>") })).ok).toBe(false);
    expect((await saveUpload(h.db, actor, { filename: "big.png", bytes: Uint8Array.from({ length: MEDIA_MAX_BYTES + 1 }, (_, i) => (i < 8 ? png[i] : 0)) })).ok).toBe(false);

    await saveSeoSettings(h.db, actor, { defaultOgImage: up.row.id, pages: {} });
    expect((await mediaUsage(h.db, up.row.id)).settings).toContain("seo");
    expect((await deleteMedia(h.db, actor, up.row.id)).ok).toBe(false);
    await saveSeoSettings(h.db, actor, { pages: {} });
    expect((await deleteMedia(h.db, actor, up.row.id)).ok).toBe(true);
  });
});

describe("contact inbox", () => {
  it("stores messages, tracks unread, changes status and deletes", async () => {
    const m = await storeMessage(h.db, { type: "hiring", name: "Pat", email: "pat@example.com", message: "Hello there, a test message." });
    expect(m.status).toBe("new");
    expect(await unreadCount(h.db)).toBeGreaterThanOrEqual(1);
    expect(await setMessageStatus(h.db, actor, m.id, "read")).toBe(true);
    expect((await listMessages(h.db, "read")).some((x) => x.id === m.id)).toBe(true);
    expect(await setMessageStatus(h.db, actor, m.id, "spam")).toBe(true);
    expect((await listMessages(h.db, "all")).some((x) => x.id === m.id)).toBe(false); // spam hidden from "all"
    expect(await deleteMessage(h.db, actor, m.id)).toBe(true);
  });
});

describe("privacy-friendly analytics", () => {
  it("only counts real public paths, honours DNT/GPC, ignores bots, and aggregates per day", async () => {
    expect(isCountablePath("/projects/geniq")).toBe(true);
    expect(isCountablePath("/admin")).toBe(false);
    expect(isCountablePath("/api/x")).toBe(false);
    expect(isCountablePath("/a?x=1")).toBe(false);
    expect(isCountablePath("<script>")).toBe(false);
    expect(isCountableRequest({ userAgent: "Mozilla/5.0 Chrome/120" })).toBe(true);
    expect(isCountableRequest({ userAgent: "Mozilla/5.0 Chrome/120", dnt: "1" })).toBe(false);
    expect(isCountableRequest({ userAgent: "Mozilla/5.0 Chrome/120", gpc: "1" })).toBe(false);
    expect(isCountableRequest({ userAgent: "Googlebot/2.1" })).toBe(false);
    expect(isCountableRequest({ userAgent: null })).toBe(false);

    const now = new Date("2026-06-15T12:00:00Z");
    await recordView(h.db, "/", now);
    await recordView(h.db, "/", now);
    await recordView(h.db, "/about/", now);
    await recordView(h.db, "/", new Date("2026-06-14T08:00:00Z"));
    const s = await summarize(h.db, 7, now);
    expect(s.today).toBe(3);
    expect(s.total).toBe(4);
    expect(s.top[0]).toEqual({ path: "/", views: 3 });
    expect(s.days).toHaveLength(7);
  });
});

describe("users still intact", () => {
  it("the owner account is unaffected", async () => {
    const [u] = await h.db.select().from(users).where(eq(users.id, actor));
    expect(u.role).toBe("owner");
  });
});
