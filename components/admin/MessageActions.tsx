"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteMessageAction, saveMessageNotesAction, setMessageStatusAction } from "@/app/admin/(protected)/_actions/features";
import type { MessageStatus } from "@/lib/messages";
import { StatusLine, SubmitButton, control, useToastAction } from "./forms";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

export function MessageActions({ id, status, notes, canManage }: { id: string; status: MessageStatus; notes: string; canManage: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [pending, start] = useTransition();
  const [state, action, saving] = useToastAction(saveMessageNotesAction);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      try {
        const res = await fn();
        toast(res.ok ? "success" : "error", res.message);
        router.refresh();
      } catch {
        toast("error", "That action failed. Please try again.");
      }
    });

  if (!canManage) return null;
  const set = (s: MessageStatus) => run(() => setMessageStatusAction(id, s));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {status !== "read" && <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => set("read")}>Mark as read</button>}
        {status !== "new" && <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => set("new")}>Mark as unread</button>}
        {status !== "archived" && <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => set("archived")}>Archive</button>}
        {status !== "spam" && <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => set("spam")}>Mark as spam</button>}
        <button
          type="button"
          disabled={pending}
          className={buttonStyles.danger}
          onClick={async () => {
            if (await confirm({ title: "Delete this message forever?", body: "This cannot be undone.", confirmLabel: "Delete forever", danger: true })) run(() => deleteMessageAction(id));
          }}
        >
          Delete
        </button>
      </div>
      <form action={action} className="space-y-2" aria-busy={saving}>
        <input type="hidden" name="id" value={id} />
        <label htmlFor={`notes-${id}`} className="block text-sm font-medium">Private notes</label>
        <textarea id={`notes-${id}`} name="notes" defaultValue={notes} rows={2} maxLength={2000} className={control} placeholder="Only you can see this" />
        <div className="flex items-center gap-3">
          <SubmitButton pending={saving} variant="secondary">Save notes</SubmitButton>
          <StatusLine state={state} />
        </div>
      </form>
    </div>
  );
}
