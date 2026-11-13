import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { listMedia } from "@/lib/media";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { PageHeader } from "@/components/admin/ui";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function MediaPage() {
  const user = await requireAdmin("content:read");
  const items = (await listMedia(await getDb())).map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Media library"
        description="Images and PDFs stored with your content. Copy a file's path into a project's Screenshots field, or choose a social image and resume file in SEO and Resume."
      />
      <MediaLibrary items={items} canWrite={can(user.role, "media:write")} />
    </div>
  );
}
