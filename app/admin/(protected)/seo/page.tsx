import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { listMedia } from "@/lib/media";
import { getSeoSettings } from "@/lib/settings";
import { SeoForm } from "@/components/admin/SeoForm";
import { PageHeader } from "@/components/admin/ui";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function SeoPage() {
  const user = await requireAdmin("content:read");
  const db = await getDb();
  const [settings, images] = await Promise.all([getSeoSettings(db), listMedia(db, { kind: "image" })]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO"
        description="Per-page titles, descriptions, social images and indexing. Project case studies use their own title and summary. Upload images in the Media library first."
      />
      {!can(user.role, "settings:write") && <p role="note" className="rounded-2xl border border-line-strong p-4 text-sm text-fg-muted">Only the owner can change SEO settings.</p>}
      <SeoForm settings={settings} images={images.map((i) => ({ id: i.id, filename: i.filename }))} canWrite={can(user.role, "settings:write")} />
    </div>
  );
}
