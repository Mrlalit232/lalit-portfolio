import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { dataToValues } from "@/lib/content/codec";
import { entities } from "@/lib/content/registry";
import { profileDefaults } from "@/lib/content/seed";
import { getSingleton, workingCopy } from "@/lib/content/service";
import { ContentForm } from "@/components/admin/ContentForm";
import { ItemActions } from "@/components/admin/ItemActions";
import { Notice } from "@/components/admin/Notice";
import { formatDate, PageHeader, StatusBadge } from "@/components/admin/ui";

export default async function ProfilePage() {
  const user = await requireAdmin("content:read");
  const def = entities.profile;
  const item = await getSingleton(await getDb(), def);
  const initial = dataToValues(def.fields, item ? workingCopy(item) : profileDefaults());

  return (
    <div className="space-y-6">
      <Suspense>
        <Notice />
      </Suspense>
      <PageHeader title="Profile" description={def.description} />
      <div className="flex flex-wrap items-center gap-3">
        {item ? (
          <>
            <StatusBadge tone={item.status}>{item.status}</StatusBadge>
            {item.status === "published" && item.draft && <StatusBadge tone="draft">unpublished changes</StatusBadge>}
            <span className="text-sm text-fg-subtle">Updated {formatDate(item.updatedAt)}</span>
            {item.status === "published" && (
              <a href="/about" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
                View on site <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              </a>
            )}
            <div className="ml-auto">
              <ItemActions
                module="profile"
                id={item.id}
                singular="Profile"
                status={item.status}
                hasDraft={Boolean(item.draft)}
                deleted={false}
                layout="bar"
                canPublish={can(user.role, "content:publish")}
                canDelete={false}
              />
            </div>
          </>
        ) : (
          <p role="note" className="rounded-xl border border-line-strong px-4 py-2 text-sm text-fg-muted">
            The profile is not in the database yet. The form is prefilled with your current details. Save &amp; publish to manage it here.
          </p>
        )}
      </div>
      <ContentForm
        key={item?.updatedAt.toISOString() ?? "new"}
        module="profile"
        id="singleton"
        fields={def.fields}
        initial={initial}
        canPublish={can(user.role, "content:publish")}
      />
    </div>
  );
}
