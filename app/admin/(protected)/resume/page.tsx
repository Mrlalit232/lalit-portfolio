import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { listMedia } from "@/lib/media";
import { resumePdfAvailable } from "@/lib/resume";
import { getResumeSettings } from "@/lib/settings";
import { ResumeManager } from "@/components/admin/ResumeManager";
import { PageHeader } from "@/components/admin/ui";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function ResumeAdminPage() {
  const user = await requireAdmin("content:read");
  const db = await getDb();
  const [pdfs, settings] = await Promise.all([listMedia(db, { kind: "pdf" }), getResumeSettings(db)]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume"
        description="The PDF behind the Download Resume buttons. The resume page's text (experience, projects, skills) is built from your published content."
      />
      <ResumeManager
        pdfs={pdfs.map((p) => ({ id: p.id, filename: p.filename, size: p.size, createdAt: p.createdAt.toISOString() }))}
        currentId={settings.mediaId ?? null}
        fallbackAvailable={resumePdfAvailable()}
        canWrite={can(user.role, "settings:write") && can(user.role, "media:write")}
      />
    </div>
  );
}
