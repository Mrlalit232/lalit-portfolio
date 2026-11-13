import Link from "next/link";
import { Mail } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { MESSAGE_STATUSES, listMessages, type MessageStatus } from "@/lib/messages";
import { inquiryTypes } from "@/lib/contact";
import { MessageActions } from "@/components/admin/MessageActions";
import { EmptyState, formatDate, PageHeader, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/components/ui/primitives";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

const TABS: { key: MessageStatus | "all"; label: string }[] = [
  { key: "all", label: "Inbox" },
  { key: "new", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
];

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  const user = await requireAdmin("messages:manage");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? "all";
  const db = await getDb();
  const [rows, unread] = await Promise.all([listMessages(db, tab), listMessages(db, "new")]);

  return (
    <div className="space-y-6">
      <PageHeader title="Contact messages" description="Messages sent through the public contact form. They are saved here first, then emailed if email delivery is configured." />
      <nav aria-label="Filter messages" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            prefetch={false}
            href={t.key === "all" ? "/admin/messages" : `/admin/messages?status=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm", tab === t.key ? "border-tech/60 bg-tech/10 font-medium" : "border-line text-fg-muted hover:border-line-strong hover:text-fg")}
          >
            {t.label}
            {t.key === "new" && <span className="ml-1 font-mono text-xs text-fg-subtle">{unread.length}</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title={tab === "all" ? "No messages yet" : "Nothing here"} body="Messages from the contact form appear here." />
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id}>
              <details className="surface rounded-3xl">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <Mail aria-hidden className="h-4 w-4 shrink-0 text-fg-muted" />
                  <div className="min-w-0 flex-1 basis-60">
                    <p className={cn("truncate", m.status === "new" ? "font-semibold" : "font-medium")}>{m.name}</p>
                    <p className="truncate text-sm text-fg-muted">{m.message.slice(0, 90)}</p>
                  </div>
                  <span className="text-xs text-fg-subtle">{formatDate(m.createdAt)}</span>
                  <StatusBadge tone={m.status === "new" ? "published" : m.status === "spam" ? "trash" : m.status === "archived" ? "archived" : "neutral"}>{m.status}</StatusBadge>
                </summary>
                <div className="space-y-4 border-t border-line px-5 py-5">
                  <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                    <dt className="text-fg-subtle">From</dt>
                    <dd>
                      {m.name} · <a className="underline hover:text-tech" href={`mailto:${encodeURIComponent(m.email).replace(/%40/g, "@")}`}>{m.email}</a>
                    </dd>
                    <dt className="text-fg-subtle">Topic</dt>
                    <dd>{inquiryTypes.find((t) => t.value === m.type)?.label ?? m.type}</dd>
                    {m.company && (
                      <>
                        <dt className="text-fg-subtle">Company</dt>
                        <dd>{m.company}</dd>
                      </>
                    )}
                    <dt className="text-fg-subtle">Emailed to you</dt>
                    <dd>{m.emailed ? "Yes" : "No (stored here only)"}</dd>
                  </dl>
                  <p className="whitespace-pre-wrap rounded-2xl bg-ink-900 p-4 text-sm leading-relaxed">{m.message}</p>
                  <MessageActions id={m.id} status={m.status as MessageStatus} notes={m.notes} canManage={can(user.role, "messages:manage")} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-fg-subtle">Statuses: {MESSAGE_STATUSES.join(", ")}. Spam is hidden from the inbox. Message text is always shown as plain text.</p>
    </div>
  );
}
