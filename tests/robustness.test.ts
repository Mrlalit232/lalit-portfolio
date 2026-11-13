import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { rawValues } from "@/lib/content/codec";
import { entities } from "@/lib/content/registry";
import { searchAll } from "@/lib/content/stats";
import * as svc from "@/lib/content/service";
import { stripNul, stripNulDeep } from "@/lib/text";
import { createAdminUser } from "@/lib/auth/users";
import { GOOD_PASSWORD, freshDb } from "./helpers";

let h: DbHandle;
let actor: string;
beforeAll(async () => {
  h = await freshDb();
  actor = (await createAdminUser(h.db, { email: "robust@example.com", password: GOOD_PASSWORD })).id;
});
afterAll(async () => {
  await h.close();
});

describe("hostile input is handled, not surfaced as a server error", () => {
  it("strips NUL characters (which Postgres cannot store) from strings and nested data", () => {
    expect(stripNul("a\u0000b")).toBe("ab");
    expect(stripNulDeep({ a: "x\u0000", b: ["y\u0000z", { c: "\u0000" }], n: 3, ok: true, nothing: null })).toEqual({ a: "x", b: ["yz", { c: "" }], n: 3, ok: true, nothing: null });
  });

  it("searching or filtering with NUL, quotes, wildcards and backslashes never throws", async () => {
    for (const q of ["\u0000", "a\u0000b", "' OR 1=1; --", "%", "_", "\\", "'; DROP TABLE content_items; --"]) {
      await expect(searchAll(h.db, q)).resolves.toBeDefined();
      await expect(svc.listItems(h.db, entities.project, { q })).resolves.toBeDefined();
    }
  });

  it("a wildcard in a search is matched literally, not as a pattern", async () => {
    await svc.createItem(h.db, entities.project, actor, {
      slug: "wild-1", title: "Plain Title", category: "Web", tagline: "t", summary: "s", status: "x", featured: false, stack: ["a"], links: [],
      caseStudy: { overview: ["o"], objective: ["o"], solution: ["s"], role: ["r"], implementation: ["i"], implemented: ["x"], planned: [], future: [] }, screenshots: [],
    });
    expect((await searchAll(h.db, "%")).length).toBe(0); // "%" must not match every row
    expect((await searchAll(h.db, "Plain")).length).toBe(1);
  });

  it("form values are cleaned, and content containing NUL is stored without it instead of failing", async () => {
    const fd = new FormData();
    fd.set("title", "Bad\u0000 Title");
    expect(rawValues([{ name: "title", label: "Title", kind: "text" }], fd).title).toBe("Bad Title");
    const res = await svc.createItem(h.db, entities.project, actor, {
      slug: "nul-1", title: "Nul\u0000Title", category: "Web", tagline: "t", summary: "s\u0000", status: "x", featured: false, stack: ["a"], links: [],
      caseStudy: { overview: ["o\u0000"], objective: ["o"], solution: ["s"], role: ["r"], implementation: ["i"], implemented: ["x"], planned: [], future: [] }, screenshots: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.item.title).toBe("NulTitle");
  });
});
