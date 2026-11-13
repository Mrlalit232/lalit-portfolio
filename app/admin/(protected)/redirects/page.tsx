import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { listRedirects } from "@/lib/redirects";
import { RedirectManager } from "@/components/admin/RedirectManager";
import { PageHeader } from "@/components/admin/ui";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function RedirectsPage() {
  const user = await requireAdmin("content:read");
  const items = (await listRedirects(await getDb())).map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath, status: r.status, enabled: r.enabled, auto: r.auto }));
  return (
    <div className="space-y-6">
      <PageHeader title="Redirects" description="Send visitors from an old URL to a new one. Loops, external hosts other than https, and reserved paths are rejected. Changes apply within a few seconds." />
      <RedirectManager items={items} canWrite={can(user.role, "settings:write")} />
    </div>
  );
}
