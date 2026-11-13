import Link from "next/link";
import { Activity, CheckCircle2, Database, HardDrive, Server, TriangleAlert } from "lucide-react";
import { hasHostedDb } from "@/db/client";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { entities, type ContentType } from "@/lib/content/registry";
import { hasAnyContent } from "@/lib/content/seed";
import { dashboardExtras, dashboardStats, healthCheck } from "@/lib/content/stats";
import { formatDate, LinkButton, PageHeader, StatusBadge, EmptyState } from "@/components/admin/ui";

export default async function Dashboard() {
  const user = await requireAdmin();
  const db = await getDb();
  const [stats, health, seeded, extras] = await Promise.all([dashboardStats(db), healthCheck(db), hasAnyContent(db), dashboardExtras(db)]);
  const { counts } = stats;
  const pending = Object.values(counts).reduce((n, c) => n + c.withUnpublishedChanges, 0);
  const moduleOf = (t: string) => entities[t as ContentType]?.module ?? "";

  const cards: { label: string; value: number; sub: string; href: string }[] = [
    { label: "Projects", value: counts.project.total, sub: `${counts.project.published} published · ${counts.project.draft} draft`, href: "/admin/projects" },
    { label: "Skills", value: stats.skills.total, sub: `${counts.skillGroup.total} categories · ${stats.skills.published} published`, href: "/admin/skills" },
    { label: "Experience", value: counts.experience.total, sub: `${counts.experience.published} published`, href: "/admin/experience" },
    { label: "Education", value: counts.education.total, sub: `${counts.education.published} published`, href: "/admin/education" },
    { label: "Certifications", value: counts.certification.total, sub: `${counts.certification.published} published`, href: "/admin/certifications" },
    { label: "Services", value: counts.service.total, sub: `${counts.service.published} published · ${counts.service.draft} draft`, href: "/admin/services" },
    { label: "Ventures", value: counts.venture.total, sub: `${counts.venture.published} published · ${counts.venture.draft} draft`, href: "/admin/ventures" },
    { label: "Testimonials", value: counts.testimonial.total, sub: counts.testimonial.published ? `${counts.testimonial.published} published` : "None published (section hidden)", href: "/admin/testimonials" },
    { label: "Unread messages", value: extras.unreadMessages, sub: extras.unreadMessages ? "Waiting in the inbox" : "Inbox is clear", href: "/admin/messages" },
    { label: "Scheduled to publish", value: extras.scheduled, sub: extras.scheduled ? "Will go live automatically" : "Nothing scheduled", href: "/admin/projects" },
    { label: "Views (7 days)", value: extras.views7, sub: "Privacy-friendly page-view count", href: "/admin/analytics" },
    { label: "Media files", value: extras.mediaFiles, sub: `${extras.redirects} active redirect(s)`, href: "/admin/media" },
    { label: "Unpublished changes", value: pending, sub: pending ? "Edits waiting to go live" : "Everything live is up to date", href: "/admin/projects" },
  ];

  const quick = [
    { href: "/admin/projects/new", label: "Add project" },
    { href: "/admin/experience/new", label: "Add experience" },
    { href: "/admin/certifications/new", label: "Add certification" },
    { href: "/admin/ventures/new", label: "Add venture" },
    { href: "/admin/testimonials/new", label: "Add testimonial" },
    { href: "/admin/media", label: "Upload media" },
    { href: "/admin/profile", label: "Update profile" },
  ];

  const statusRows = [
    {
      icon: Database,
      label: "Database",
      ok: health.ok,
      detail: health.ok ? `${hasHostedDb() ? "Neon (hosted)" : "Embedded local database"} · responded in ${health.ms} ms` : `Unreachable: ${health.error}`,
    },
    {
      icon: Server,
      label: "Public site content",
      ok: seeded,
      detail: seeded ? "Served from the database (published items only)" : "Using the built-in static content. Run `npm run db:seed` to import it into the database.",
    },
    { icon: HardDrive, label: "File storage", ok: true, detail: `Media library stores ${extras.mediaFiles} file(s) in the database (PNG, JPEG, GIF, WebP, PDF up to 3 MB each).` },
    { icon: Activity, label: "Application", ok: true, detail: `Running on Node ${process.version}` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description={`Signed in as ${user.email}. All figures come from the database.`} />

      <section aria-label="Content overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link prefetch={false} key={c.label} href={c.href} className="surface surface-hover min-w-0 rounded-2xl p-4 sm:p-5">
            <p className="text-sm text-fg-muted">{c.label}</p>
            <p className="mt-2 font-display text-3xl sm:text-4xl">{c.value}</p>
            <p className="mt-1 text-xs text-fg-subtle">{c.sub}</p>
          </Link>
        ))}
      </section>

      <section aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          {quick.map((q, i) => (
            <LinkButton key={q.href} href={q.href} variant={i === 0 ? "primary" : "secondary"}>
              {q.label}
            </LinkButton>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="updates-heading" className="surface min-w-0 rounded-3xl p-6">
          <h2 id="updates-heading" className="font-display text-2xl">Recent content updates</h2>
          {stats.recentContent.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nothing yet" body="Content you create or edit appears here." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {stats.recentContent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link prefetch={false} href={`/admin/${moduleOf(r.type)}${entities[r.type as ContentType]?.singleton ? "" : `/${r.id}`}`} className="block truncate text-sm font-medium hover:text-tech">
                      {r.title}
                    </Link>
                    <p className="text-xs text-fg-subtle">
                      {entities[r.type as ContentType]?.singular} · {formatDate(r.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <StatusBadge tone={r.status}>{r.status}</StatusBadge>
                    {r.hasDraft && r.status === "published" && <StatusBadge tone="draft">changes</StatusBadge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="activity-heading" className="surface min-w-0 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 id="activity-heading" className="font-display text-2xl">Recent activity</h2>
            <Link prefetch={false} href="/admin/activity" className="text-sm text-fg-muted hover:text-fg">View all</Link>
          </div>
          {stats.recentActivity.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No activity yet" body="Sign-ins and content changes are recorded here." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {stats.recentActivity.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="text-sm">{a.summary}</p>
                  <p className="text-xs text-fg-subtle">
                    {a.actor ?? "System"} · {formatDate(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="health-heading" className="surface rounded-3xl p-6">
        <h2 id="health-heading" className="font-display text-2xl">Website content status &amp; system health</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {statusRows.map((s) => (
            <li key={s.label} className="flex gap-3">
              <s.icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted" />
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {s.label}
                  {s.ok ? <CheckCircle2 aria-label="OK" className="h-4 w-4 text-tech" /> : <TriangleAlert aria-label="Needs attention" className="h-4 w-4 text-business" />}
                </p>
                <p className="text-sm text-fg-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        {stats.trash > 0 && <p className="mt-4 text-xs text-fg-subtle">{stats.trash} item(s) in Trash across all modules.</p>}
      </section>
    </div>
  );
}
