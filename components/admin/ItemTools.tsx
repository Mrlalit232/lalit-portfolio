"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Check, Copy, Eye, History } from "lucide-react";
import { createPreviewAction, restoreRevisionAction, revokePreviewAction, schedulePublishAction } from "@/app/admin/(protected)/_actions/features";
import { control } from "./forms";
import { buttonStyles, formatDate } from "./ui";
import { useAdminUi } from "./provider";

export type RevisionRow = { id: string; version: number; reason: string; title: string; createdAt: string };

type Props = {
  module: string;
  id: string;
  previewable: boolean;
  canWrite: boolean;
  canPublish: boolean;
  schedulable: boolean;
  publishAt: string | null;
  activePreviewLinks: number;
  revisions: RevisionRow[];
};

const REASON: Record<string, string> = { save: "Draft saved", publish: "Published", unpublish: "Unpublished", restore: "Restored from an earlier revision", schedule: "Scheduled" };

export function ItemTools({ module, id, previewable, canWrite, canPublish, schedulable, publishAt, activePreviewLinks, revisions }: Props) {
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [pending, start] = useTransition();
  const [hours, setHours] = useState("24");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [when, setWhen] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message: string; url?: string }>, after?: (r: { url?: string }) => void) =>
    start(async () => {
      try {
        const res = await fn();
        toast(res.ok ? "success" : "error", res.message);
        if (res.ok) after?.(res);
        router.refresh();
      } catch {
        toast("error", "That action failed. Please try again.");
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {previewable && canWrite && (
        <section aria-labelledby="preview-heading" className="surface min-w-0 space-y-3 rounded-3xl p-6">
          <h2 id="preview-heading" className="flex items-center gap-2 font-display text-2xl">
            <Eye aria-hidden className="h-5 w-5 text-tech" /> Preview link
          </h2>
          <p className="text-sm text-fg-muted">Share the current draft with someone before it goes live. The link expires, is hidden from search engines, and can be revoked.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="preview-hours" className="mb-1.5 block text-sm font-medium">Valid for</label>
              <select id="preview-hours" value={hours} onChange={(e) => setHours(e.target.value)} className={control}>
                <option value="1">1 hour</option>
                <option value="24">1 day</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
              </select>
            </div>
            <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run(() => createPreviewAction(module, id, Number(hours)), (r) => { setLink(r.url ? `${window.location.origin}${r.url}` : null); setCopied(false); })}>
              Create link
            </button>
            {activePreviewLinks > 0 && (
              <button type="button" disabled={pending} className={buttonStyles.ghost} onClick={() => run(() => revokePreviewAction(module, id), () => setLink(null))}>
                Revoke {activePreviewLinks} active link{activePreviewLinks === 1 ? "" : "s"}
              </button>
            )}
          </div>
          {link && (
            <div className="space-y-2 rounded-2xl border border-line-strong p-3">
              <p className="break-all font-mono text-xs">{link}</p>
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    toast("error", "Copy the link manually.");
                  }
                }}
              >
                {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
              </button>
              <p className="text-xs text-fg-subtle">This link is shown only now. Anyone who has it can see this draft until it expires or is revoked.</p>
            </div>
          )}
        </section>
      )}

      {canPublish && schedulable && (
        <section aria-labelledby="schedule-heading" className="surface min-w-0 space-y-3 rounded-3xl p-6">
          <h2 id="schedule-heading" className="flex items-center gap-2 font-display text-2xl">
            <CalendarClock aria-hidden className="h-5 w-5 text-tech" /> Schedule publishing
          </h2>
          {publishAt ? (
            <>
              <p className="text-sm">Scheduled to go live <strong className="font-medium">{formatDate(publishAt)}</strong>. Editing the draft before then is fine; the version saved at that time is published.</p>
              <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run(() => schedulePublishAction(module, id, null))}>
                Cancel schedule
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-fg-muted">Publish the current draft automatically at a time you choose (shown in your local time).</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="schedule-when" className="mb-1.5 block text-sm font-medium">Publish at</label>
                  <input id="schedule-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={control} />
                </div>
                <button
                  type="button"
                  disabled={pending || !when}
                  className={buttonStyles.secondary}
                  onClick={() => run(() => schedulePublishAction(module, id, new Date(when).toISOString()), () => setWhen(""))}
                >
                  Schedule
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="revisions-heading" className="surface min-w-0 space-y-3 rounded-3xl p-6 lg:col-span-2">
        <h2 id="revisions-heading" className="flex items-center gap-2 font-display text-2xl">
          <History aria-hidden className="h-5 w-5 text-tech" /> Revision history
        </h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-fg-muted">No revisions yet. A snapshot is saved every time you save or publish.</p>
        ) : (
          <ul className="divide-y divide-line">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-10 font-mono text-xs text-fg-subtle">v{r.version}</span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-fg-subtle">{REASON[r.reason] ?? r.reason} · {formatDate(r.createdAt)}</p>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    disabled={pending}
                    className={buttonStyles.secondary}
                    onClick={async () => {
                      if (await confirm({ title: `Restore version ${r.version}?`, body: "It becomes the current draft (replacing unsaved draft edits). The live version is not changed until you publish.", confirmLabel: "Restore as draft" })) run(() => restoreRevisionAction(module, id, r.id));
                    }}
                  >
                    Restore as draft
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-fg-subtle">The most recent 50 revisions are kept.</p>
      </section>
    </div>
  );
}
