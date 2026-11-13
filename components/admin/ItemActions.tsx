"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { itemOpAction, type ItemOp } from "@/app/admin/(protected)/_actions/content";
import { cn } from "@/components/ui/primitives";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

type Props = {
  module: string;
  id: string;
  singular: string;
  status: "draft" | "published" | "archived";
  hasDraft: boolean;
  deleted: boolean;
  /** "menu" = compact dropdown for list rows; "bar" = inline buttons for the editor header. */
  layout: "menu" | "bar";
  reorderable?: boolean;
  canPublish?: boolean;
  canDelete?: boolean;
  /** Where to go after the item stops existing in this view (delete/purge from the editor). */
  afterRemove?: string;
};

export function ItemActions({ module, id, singular, status, hasDraft, deleted, layout, reorderable, canPublish = true, canDelete = true, afterRemove }: Props) {
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<ItemOp | null>(null);

  // Confirmation happens BEFORE the transition: a dialog opened from inside an async transition would
  // wait for the transition to finish, which waits for the dialog (deadlock).
  const run = async (op: ItemOp, confirmation?: Parameters<typeof confirm>[0]) => {
    if (confirmation && !(await confirm(confirmation))) return;
    start(async () => {
      setBusy(op);
      try {
        const res = await itemOpAction(module, id, op);
        toast(res.ok ? "success" : "error", res.message);
        if (res.ok && afterRemove && (op === "delete" || op === "purge")) router.push(afterRemove);
        else router.refresh();
      } catch {
        toast("error", "That action failed. Please try again.");
      } finally {
        setBusy(null);
      }
    });
  };

  const label = singular.toLowerCase();
  type Entry = { op: ItemOp; label: string; danger?: boolean; confirmation?: Parameters<typeof confirm>[0] };
  const entries: Entry[] = [];
  if (!deleted) {
    if (canPublish && (status !== "published" || hasDraft)) entries.push({ op: "publish", label: hasDraft && status === "published" ? "Publish changes" : "Publish" });
    if (canPublish && status === "published")
      entries.push({ op: "unpublish", label: "Unpublish", confirmation: { title: `Unpublish this ${label}?`, body: "It will disappear from the public website but stay here as a draft.", confirmLabel: "Unpublish" } });
    if (status === "published" && hasDraft)
      entries.push({ op: "discard", label: "Discard changes", confirmation: { title: "Discard unpublished changes?", body: "The live version stays as it is. Your draft edits will be lost.", confirmLabel: "Discard", danger: true } });
    entries.push(status === "archived" ? { op: "unarchive", label: "Unarchive" } : { op: "archive", label: "Archive", confirmation: { title: `Archive this ${label}?`, body: "Archived items are hidden from the public website.", confirmLabel: "Archive" } });
    entries.push({ op: "duplicate", label: "Duplicate" });
    if (canDelete)
      entries.push({ op: "delete", label: "Move to Trash", danger: true, confirmation: { title: `Move this ${label} to Trash?`, body: "It will be removed from the public website. You can restore it from the Trash tab.", confirmLabel: "Move to Trash", danger: true } });
  } else if (canDelete) {
    entries.push({ op: "restore", label: "Restore" });
    entries.push({ op: "purge", label: "Delete forever", danger: true, confirmation: { title: `Delete this ${label} forever?`, body: "This cannot be undone.", confirmLabel: "Delete forever", danger: true } });
  }

  const reorder: Entry[] = reorderable && !deleted ? [{ op: "up", label: "Move up" }, { op: "down", label: "Move down" }] : [];

  if (layout === "bar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {[...entries].map((e) => (
          <button
            key={e.op}
            type="button"
            disabled={pending}
            onClick={() => run(e.op, e.confirmation)}
            className={e.danger ? buttonStyles.danger : e.op === "publish" ? buttonStyles.primary : buttonStyles.secondary}
          >
            {busy === e.op && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {e.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <details className="relative">
      <summary
        aria-label={`Actions for this ${label}`}
        className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-line-strong hover:bg-white/[0.06] [&::-webkit-details-marker]:hidden"
      >
        {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <MoreHorizontal aria-hidden className="h-4 w-4" />}
      </summary>
      <div role="menu" className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-line-strong bg-ink-900 p-1.5 shadow-xl">
        {[...reorder, ...entries].map((e) => (
          <button
            key={e.op}
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={(ev) => {
              (ev.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
              run(e.op, e.confirmation);
            }}
            className={cn("flex w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/[0.06]", e.danger ? "text-red-400" : "text-fg")}
          >
            {e.label}
          </button>
        ))}
      </div>
    </details>
  );
}
