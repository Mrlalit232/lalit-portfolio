import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { createDb, runMigrations } from "@/db/client";
import { contentItems, users } from "@/db/schema";
import { entities } from "@/lib/content/registry";
import { seedContent } from "@/lib/content/seed";
import * as svc from "@/lib/content/service";
import { createAdminUser } from "@/lib/auth/users";
import { GOOD_PASSWORD } from "./helpers";

const root = mkdtempSync(path.join(tmpdir(), "pglite-persist-"));
const dir = path.join(root, "db");
afterAll(() => rmSync(root, { recursive: true, force: true }));

const project = (over: Record<string, unknown> = {}) => ({
  slug: "persist-me",
  title: "Persist Me",
  category: "Web",
  tagline: "t",
  summary: "s",
  status: "Test",
  featured: false,
  stack: ["TypeScript"],
  links: [],
  caseStudy: { overview: ["o"], objective: ["o"], solution: ["s"], role: ["r"], implementation: ["i"], implemented: ["x"], planned: [], future: [] },
  screenshots: [],
  ...over,
});

describe("a file-backed local database (what `npm run dev` uses)", () => {
  it("keeps users and published content across a full close and reopen, and re-running migrations is a no-op", async () => {
    let h = await createDb({ pgliteDir: dir, url: "" });
    await runMigrations(h);
    const actor = (await createAdminUser(h.db, { email: "persist@example.com", password: GOOD_PASSWORD })).id;
    const created = await svc.createItem(h.db, entities.project, actor, project());
    if (!created.ok) throw new Error("create");
    expect((await svc.publish(h.db, entities.project, created.item.id, actor)).ok).toBe(true);
    await h.close();

    // "Restart the application": a brand-new handle on the same folder.
    h = await createDb({ pgliteDir: dir, url: "" });
    await runMigrations(h); // must not fail or duplicate anything
    const found = await h.db.select().from(users).where(eq(users.email, "persist@example.com"));
    expect(found).toHaveLength(1);
    const rows = await h.db.select().from(contentItems).where(and(eq(contentItems.slug, "persist-me"), isNull(contentItems.deletedAt)));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("published");
    expect((rows[0].data as { title: string }).title).toBe("Persist Me");
    await h.close();
  });

  it("seeding is safe to run repeatedly: no duplicates, and an owner's edit is never overwritten", async () => {
    const h = await createDb({ pgliteDir: dir, url: "" });
    await runMigrations(h);
    const first = await seedContent(h.db);
    expect(first.created).toBeGreaterThan(0);
    const second = await seedContent(h.db);
    expect(second.created).toBe(0); // everything already present
    expect(second.skipped).toBe(first.created + first.skipped);

    // The owner renames a seeded project; a later seed must leave it alone.
    const [geniq] = await h.db.select().from(contentItems).where(and(eq(contentItems.type, "project"), eq(contentItems.slug, "geniq")));
    await h.db.update(contentItems).set({ title: "GenIQ (renamed by owner)" }).where(eq(contentItems.id, geniq.id));
    await seedContent(h.db);
    const [after] = await h.db.select().from(contentItems).where(eq(contentItems.id, geniq.id));
    expect(after.title).toBe("GenIQ (renamed by owner)");
    const dupes = await h.db.select().from(contentItems).where(and(eq(contentItems.type, "project"), eq(contentItems.slug, "geniq")));
    expect(dupes).toHaveLength(1);
    await h.close();
  });

  it("an invalid operation fails safely and leaves the database fully usable", async () => {
    const h = await createDb({ pgliteDir: dir, url: "" });
    await runMigrations(h);
    const actor = (await h.db.select().from(users))[0].id;
    // Duplicate slug is rejected by the service...
    const dup = await svc.createItem(h.db, entities.project, actor, project());
    expect(dup.ok).toBe(false);
    // ...and a raw duplicate insert is rejected by the database constraint itself.
    await expect(h.db.insert(contentItems).values({ type: "project", slug: "persist-me", title: "x", data: {}, status: "draft" })).rejects.toThrow();
    // Invalid content never reaches the table.
    const bad = await svc.createItem(h.db, entities.project, actor, project({ slug: "Bad Slug!", links: [{ label: "x", href: "javascript:alert(1)" }] }));
    expect(bad.ok).toBe(false);
    // The connection is still healthy afterwards.
    const rows = await h.db.select().from(contentItems).where(eq(contentItems.slug, "persist-me"));
    expect(rows).toHaveLength(1);
    await h.close();
  });
});
