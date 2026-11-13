import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, runMigrations, type Db } from "@/db/client";

const rows = async (db: Db, q: ReturnType<typeof sql>) => ((await db.execute(q)) as unknown as { rows: Record<string, unknown>[] }).rows;

const tmp = mkdtempSync(path.join(tmpdir(), "migrations-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A copy of the migrations folder containing only the first `n` migrations (what an existing install has applied). */
function firstMigrations(n: number) {
  const dir = path.join(tmp, `first-${n}`);
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
  journal.entries = journal.entries.slice(0, n);
  writeFileSync(path.join(dir, "meta/_journal.json"), JSON.stringify(journal));
  for (const e of journal.entries) cpSync(`db/migrations/${e.tag}.sql`, path.join(dir, `${e.tag}.sql`));
  return dir;
}

describe("migration 0002 on an existing, populated database", () => {
  it("is additive: existing users, content and sessions survive untouched, and new columns default safely", async () => {
    const h = await createDb({ pgliteDir: null, url: "" });
    try {
      // 1. A database exactly as the previous release left it (migrations 0000 and 0001 only).
      await runMigrations(h, firstMigrations(2));
      await h.db.execute(sql`insert into users (id, email, password_hash, role) values ('11111111-1111-4111-8111-111111111111', 'old@example.com', 'hash', 'owner')`);
      await h.db.execute(sql`insert into content_items (id, type, slug, title, status, data) values ('22222222-2222-4222-8222-222222222222', 'project', 'old-project', 'Old Project', 'published', '{"title":"Old Project"}'::jsonb)`);
      await h.db.execute(sql`insert into sessions (id, user_id, expires_at) values ('abc', '11111111-1111-4111-8111-111111111111', now() + interval '1 hour')`);

      // 2. Upgrade with the full set of migrations (what `npm run db:migrate` does).
      await runMigrations(h);

      const users = await rows(h.db, sql`select email, role, totp_secret_enc, totp_enabled_at, totp_last_step from users`);
      expect(users).toEqual([{ email: "old@example.com", role: "owner", totp_secret_enc: null, totp_enabled_at: null, totp_last_step: null }]);
      const items = await rows(h.db, sql`select title, status, publish_at, data from content_items`);
      expect(items).toEqual([{ title: "Old Project", status: "published", publish_at: null, data: { title: "Old Project" } }]);
      expect((await rows(h.db, sql`select count(*)::int as n from sessions`))[0]).toEqual({ n: 1 });

      // 3. New tables exist and are empty.
      for (const t of ["content_revisions", "preview_links", "media", "contact_messages", "redirects", "site_settings", "page_views", "recovery_codes"]) {
        const r = await rows(h.db, sql.raw(`select count(*)::int as n from ${t}`));
        expect(r[0], t).toEqual({ n: 0 });
      }

      // 4. Re-running is a no-op (idempotent).
      await runMigrations(h);
    } finally {
      await h.close();
    }
  });

  it("contains no destructive statements", () => {
    const sqlText = readFileSync("db/migrations/0002_noisy_nico_minoru.sql", "utf8");
    expect(sqlText).not.toMatch(/\bdrop\s+(table|column|index|constraint)\b/i);
    expect(sqlText).not.toMatch(/\btruncate\b|\bdelete\s+from\b|\balter\s+column\b/i);
  });
});
