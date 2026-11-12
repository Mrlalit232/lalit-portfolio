import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { recentActivityFull } from "@/lib/content/stats";
import { EmptyState, formatDate, PageHeader } from "@/components/admin/ui";

export default async function ActivityPage() {
  await requireAdmin("content:read");
  const rows = await recentActivityFull(await getDb(), 100);
  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="Sign-ins and content changes (latest 100). Passwords and content bodies are never logged." />
      {rows.length === 0 ? (
        <EmptyState title="No activity yet" body="Actions you take in the admin panel are recorded here." />
      ) : (
        <ul className="surface divide-y divide-line rounded-3xl">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div>
                <p className="text-sm">{r.summary}</p>
                <p className="text-xs text-fg-subtle">
                  {r.actor ?? "System"} · <span className="font-mono">{r.action}</span>
                </p>
              </div>
              <p className="text-xs text-fg-subtle">{formatDate(r.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
