import { summarize } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function AnalyticsPage() {
  await requireAdmin("content:read");
  const s = await summarize(await getDb(), 30);
  const max = Math.max(1, ...s.days.map((d) => d.views));
  const cards = [
    { label: "Today", value: s.today },
    { label: "Last 7 days", value: s.last7 },
    { label: "Last 30 days", value: s.total },
  ];
  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Page views counted by this site itself. Privacy-first: no cookies, no IP addresses, no visitor identifiers. Visitors with Do Not Track or Global Privacy Control, and known bots, are not counted."
      />
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="surface rounded-2xl p-5">
            <p className="text-sm text-fg-muted">{c.label}</p>
            <p className="mt-2 font-display text-4xl">{c.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="daily-heading" className="surface min-w-0 rounded-3xl p-6">
        <h2 id="daily-heading" className="font-display text-2xl">Views per day (last 30 days)</h2>
        <div role="img" aria-label={`Daily page views, highest day ${max}`} className="mt-6 flex h-40 items-end gap-1">
          {s.days.map((d) => (
            <div key={d.day} className="flex min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.views}`}>
              <div className="w-full rounded-t bg-tech/70" style={{ height: `${Math.max(d.views ? 4 : 1, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }} />
            </div>
          ))}
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-fg-muted hover:text-fg">Show the numbers</summary>
          <table className="mt-3 w-full text-left">
            <caption className="sr-only">Page views per day</caption>
            <thead>
              <tr className="text-fg-subtle"><th scope="col" className="py-1 font-normal">Day (UTC)</th><th scope="col" className="py-1 text-right font-normal">Views</th></tr>
            </thead>
            <tbody>
              {[...s.days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line"><td className="py-1.5">{d.day}</td><td className="py-1.5 text-right font-mono">{d.views}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="top-heading" className="surface min-w-0 rounded-3xl p-6">
        <h2 id="top-heading" className="font-display text-2xl">Most viewed pages</h2>
        {s.top.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">No views recorded yet. Counting starts when visitors open the public pages.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Most viewed pages in the last 30 days</caption>
            <thead>
              <tr className="text-fg-subtle"><th scope="col" className="py-1 font-normal">Page</th><th scope="col" className="py-1 text-right font-normal">Views</th></tr>
            </thead>
            <tbody>
              {s.top.map((t) => (
                <tr key={t.path} className="border-t border-line"><td className="break-all py-2 font-mono">{t.path}</td><td className="py-2 text-right font-mono">{t.views}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
