import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { dataToValues } from "@/lib/content/codec";
import { entityByModule } from "@/lib/content/registry";
import { publicPath } from "@/lib/content/seed";
import { getItem, workingCopy } from "@/lib/content/service";
import { ContentForm } from "@/components/admin/ContentForm";
import { ItemActions } from "@/components/admin/ItemActions";
import { Notice } from "@/components/admin/Notice";
import { formatDate, PageHeader, StatusBadge } from "@/components/admin/ui";

export default async function EditItem({ params }: PageProps<"/admin/[module]/[id]">) {
  const user = await requireAdmin("content:read");
  const { module, id } = await params;
  const def = entityByModule(module);
  if (!def || def.singleton) notFound();
  const item = await getItem(await getDb(), def, id);
  if (!item) notFound();

  const deleted = Boolean(item.deletedAt);
  const live = item.status === "published" && !deleted;

  return (
    <div className="space-y-6">
      <Suspense>
        <Notice />
      </Suspense>
      <PageHeader title={item.title} description={`${def.singular} · last updated ${formatDate(item.updatedAt)}`} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={deleted ? "trash" : item.status}>{deleted ? "in trash" : item.status}</StatusBadge>
        {live && item.draft && <StatusBadge tone="draft">unpublished changes</StatusBadge>}
        {live && (
          <a
            href={publicPath(def.type, item.data)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
          >
            View on site <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
        )}
        <div className="ml-auto">
          <ItemActions
            module={module}
            id={item.id}
            singular={def.singular}
            status={item.status}
            hasDraft={Boolean(item.draft)}
            deleted={deleted}
            layout="bar"
            canPublish={can(user.role, "content:publish")}
            canDelete={can(user.role, "content:delete")}
            afterRemove={`/admin/${module}`}
          />
        </div>
      </div>

      {deleted ? (
        <p role="note" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          This {def.singular.toLowerCase()} is in Trash and is not public. Restore it to edit.
        </p>
      ) : (
        <ContentForm
          key={item.updatedAt.toISOString()}
          module={module}
          id={item.id}
          fields={def.fields}
          initial={dataToValues(def.fields, workingCopy(item))}
          canPublish={can(user.role, "content:publish")}
        />
      )}
    </div>
  );
}
