import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { entityByModule } from "@/lib/content/registry";
import { listItems, workingCopy, type StatusFilter } from "@/lib/content/service";
import { BulkProvider, RowCheck } from "@/components/admin/Bulk";
import { ItemActions } from "@/components/admin/ItemActions";
import { EmptyState, formatDate, LinkButton, PageHeader, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/components/ui/primitives";

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
  { key: "trash", label: "Trash" },
];

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function ModuleList({ params, searchParams }: PageProps<"/admin/[module]">) {
  const user = await requireAdmin("content:read");
  const { module } = await params;
  const def = entityByModule(module);
  if (!def || def.singleton) notFound();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const tab = TABS.some((t) => t.key === sp.status) ? (sp.status as StatusFilter) : "all";

  const db = await getDb();
  const [live, trash] = await Promise.all([listItems(db, def, { q }), listItems(db, def, { status: "trash", q })]);
  const counts: Record<StatusFilter, number> = {
    all: live.length,
    published: live.filter((i) => i.status === "published").length,
    draft: live.filter((i) => i.status === "draft").length,
    archived: live.filter((i) => i.status === "archived").length,
    trash: trash.length,
  };
  const rows = tab === "trash" ? trash : tab === "all" ? live : live.filter((i) => i.status === tab);
  const reorderable = tab === "all" && !q;
  const PAGE_SIZE = 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageNo = Math.min(Math.max(Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1, 1), pageCount);
  const visible = rows.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE);
  const href = (status: StatusFilter, page = 1) => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/${module}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={def.plural}
        description={def.description}
        actions={
          can(user.role, "content:write") && (
            <LinkButton href={`/admin/${module}/new`}>
              <Plus aria-hidden className="h-4 w-4" /> New {def.singular.toLowerCase()}
            </LinkButton>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm",
                tab === t.key ? "border-tech/60 bg-tech/10 font-medium" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {t.label} <span className="ml-1 font-mono text-xs text-fg-subtle">{counts[t.key]}</span>
            </Link>
          ))}
        </nav>
        <form action={`/admin/${module}`} role="search" className="flex items-center gap-2">
          {tab !== "all" && <input type="hidden" name="status" value={tab} />}
          <label htmlFor="list-q" className="sr-only">
            Search {def.plural.toLowerCase()}
          </label>
          <input
            id="list-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={`Search ${def.plural.toLowerCase()}…`}
            className="h-9 w-56 rounded-full border border-line-strong bg-transparent px-4 text-sm placeholder:text-fg-subtle focus-visible:border-tech"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={q ? "No matches" : tab === "trash" ? "Trash is empty" : `No ${def.plural.toLowerCase()} here yet`}
          body={
            q
              ? `Nothing matches “${q}”.`
              : tab === "trash"
                ? "Deleted items appear here and can be restored."
                : `Create your first ${def.singular.toLowerCase()}. It stays private until you publish it.`
          }
          action={
            !q && tab !== "trash" && can(user.role, "content:write") ? (
              <LinkButton href={`/admin/${module}/new`}>New {def.singular.toLowerCase()}</LinkButton>
            ) : undefined
          }
        />
      ) : (
        <BulkProvider
          module={module}
          singular={def.singular}
          ids={visible.map((i) => i.id)}
          inTrash={tab === "trash"}
          canWrite={can(user.role, "content:write")}
          canPublish={can(user.role, "content:publish")}
          canDelete={can(user.role, "content:delete")}
        >
        <ul className="surface divide-y divide-line rounded-3xl">
          {visible.map((item) => {
            const data = workingCopy(item);
            const deleted = Boolean(item.deletedAt);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <RowCheck id={item.id} label={item.title} />
                <div className="min-w-0 flex-1 basis-60">
                  {deleted ? (
                    <p className="truncate font-medium">{item.title}</p>
                  ) : (
                    <Link prefetch={false} href={`/admin/${module}/${item.id}`} className="block truncate font-medium hover:text-tech">
                      {item.title}
                    </Link>
                  )}
                  <p className="truncate text-sm text-fg-muted">{def.subtitle(data)}</p>
                  <p className="mt-0.5 text-xs text-fg-subtle">Updated {formatDate(item.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge tone={deleted ? "trash" : item.status}>{deleted ? "in trash" : item.status}</StatusBadge>
                  {!deleted && item.status === "published" && item.draft && <StatusBadge tone="draft">unpublished changes</StatusBadge>}
                  {!deleted && item.publishAt && <StatusBadge tone="neutral">scheduled {formatDate(item.publishAt)}</StatusBadge>}
                </div>
                <ItemActions
                  module={module}
                  id={item.id}
                  singular={def.singular}
                  status={item.status}
                  hasDraft={Boolean(item.draft)}
                  deleted={deleted}
                  layout="menu"
                  reorderable={reorderable}
                  canPublish={can(user.role, "content:publish")}
                  canDelete={can(user.role, "content:delete")}
                />
              </li>
            );
          })}
        </ul>
        </BulkProvider>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-muted">
            Page {pageNo} of {pageCount} · {rows.length} items
          </span>
          <span className="flex gap-2">
            {pageNo > 1 && <Link prefetch={false} href={href(tab, pageNo - 1)} className="rounded-full border border-line-strong px-4 py-1.5 hover:bg-white/[0.06]">Previous</Link>}
            {pageNo < pageCount && <Link prefetch={false} href={href(tab, pageNo + 1)} className="rounded-full border border-line-strong px-4 py-1.5 hover:bg-white/[0.06]">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  );
}
