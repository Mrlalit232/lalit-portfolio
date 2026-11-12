import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { entities, type ContentType } from "@/lib/content/registry";
import { searchAll } from "@/lib/content/stats";
import { EmptyState, formatDate, PageHeader, StatusBadge } from "@/components/admin/ui";

export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  await requireAdmin("content:read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const results = q ? await searchAll(await getDb(), q) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description={q ? `Results for “${q}” across all content (Trash excluded).` : "Type in the search box above to search all content."}
      />
      {q && results.length === 0 && (
        <EmptyState title="No matches" body="Try a different word. Search covers titles and body text, including unpublished drafts." />
      )}
      {results.length > 0 && (
        <ul className="surface divide-y divide-line rounded-3xl">
          {results.map((r) => {
            const def = entities[r.type as ContentType];
            const href = def?.singleton ? `/admin/${def.module}` : `/admin/${def?.module}/${r.id}`;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1 basis-60">
                  <Link prefetch={false} href={href} className="block truncate font-medium hover:text-tech">
                    {r.title}
                  </Link>
                  <p className="text-xs text-fg-subtle">
                    {def?.singular} · updated {formatDate(r.updatedAt)}
                  </p>
                </div>
                <StatusBadge tone={r.status}>{r.status}</StatusBadge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
