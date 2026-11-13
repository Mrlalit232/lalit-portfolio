"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { bulkAction } from "@/app/admin/(protected)/_actions/features";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

type Ctx = { selected: Set<string>; toggle: (id: string) => void };
const BulkContext = createContext<Ctx | null>(null);

type Props = {
  module: string;
  singular: string;
  /** Every id on the current page, for "select all". */
  ids: string[];
  inTrash: boolean;
  canWrite: boolean;
  canPublish: boolean;
  canDelete: boolean;
  children: ReactNode;
};

/** Selection state for a list. Rows (server-rendered) register checkboxes through <RowCheck />. */
export function BulkProvider({ module, singular, ids, inTrash, canWrite, canPublish, canDelete, children }: Props) {
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const all = ids.length > 0 && ids.every((i) => selected.has(i));

  const run = async (op: "publish" | "unpublish" | "archive" | "delete" | "restore" | "purge", confirmation?: Parameters<typeof confirm>[0]) => {
    if (confirmation && !(await confirm(confirmation))) return;
    const chosen = ids.filter((i) => selected.has(i));
    start(async () => {
      try {
        const res = await bulkAction(module, chosen, op);
        toast(res.ok ? "success" : "error", res.message);
        setSelected(new Set());
        router.refresh();
      } catch {
        toast("error", "That action failed. Please try again.");
      }
    });
  };

  const count = ids.filter((i) => selected.has(i)).length;
  const noun = singular.toLowerCase();
  const show = canWrite || canPublish || canDelete;

  return (
    <BulkContext.Provider value={{ selected, toggle }}>
      {show && ids.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(ids))} className="h-4 w-4" />
            Select all on this page
          </label>
          <span aria-live="polite" className="text-fg-muted">{count > 0 ? `${count} selected` : ""}</span>
          {count > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              {inTrash ? (
                <>
                  {canDelete && <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run("restore")}>Restore</button>}
                  {canDelete && (
                    <button type="button" disabled={pending} className={buttonStyles.danger} onClick={() => run("purge", { title: `Delete ${count} ${noun}(s) forever?`, body: "This cannot be undone.", confirmLabel: "Delete forever", danger: true })}>
                      Delete forever
                    </button>
                  )}
                </>
              ) : (
                <>
                  {canPublish && <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run("publish")}>Publish</button>}
                  {canPublish && (
                    <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run("unpublish", { title: `Unpublish ${count} ${noun}(s)?`, body: "They disappear from the public website but stay here as drafts.", confirmLabel: "Unpublish" })}>
                      Unpublish
                    </button>
                  )}
                  {canWrite && (
                    <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run("archive", { title: `Archive ${count} ${noun}(s)?`, body: "Archived items are hidden from the public website.", confirmLabel: "Archive" })}>
                      Archive
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" disabled={pending} className={buttonStyles.danger} onClick={() => run("delete", { title: `Move ${count} ${noun}(s) to Trash?`, body: "You can restore them from the Trash tab.", confirmLabel: "Move to Trash", danger: true })}>
                      Move to Trash
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {children}
    </BulkContext.Provider>
  );
}

export function RowCheck({ id, label }: { id: string; label: string }) {
  const ctx = useContext(BulkContext);
  if (!ctx) return null;
  return <input type="checkbox" aria-label={`Select ${label}`} checked={ctx.selected.has(id)} onChange={() => ctx.toggle(id)} className="h-4 w-4 shrink-0" />;
}
