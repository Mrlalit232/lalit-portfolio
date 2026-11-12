import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { entityByModule } from "@/lib/content/registry";
import { listItems, workingCopy, type StatusFilter } from "@/lib/content/service";
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
  const href = (status: StatusFilter) => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (q) p.set("q", q);
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
        <ul className="surface divide-y divide-line rounded-3xl">
          {rows.map((item) => {
            const data = workingCopy(item);
            const deleted = Boolean(item.deletedAt);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
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
      )}
    </div>
  );
}
