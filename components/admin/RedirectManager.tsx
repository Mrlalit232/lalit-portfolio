"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { deleteRedirectAction, saveRedirectAction, toggleRedirectAction } from "@/app/admin/(protected)/_actions/features";
import { Field, StatusLine, SubmitButton, TextField, control, useToastAction } from "./forms";
import { StatusBadge, buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

export type RedirectItem = { id: string; fromPath: string; toPath: string; status: number; enabled: boolean; auto: boolean };

function Row({ r, canWrite }: { r: RedirectItem; canWrite: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [pending, start] = useTransition();
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
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1 basis-72">
        <p className="flex flex-wrap items-center gap-2 break-all font-mono text-sm">
          {r.fromPath} <ArrowRight aria-label="redirects to" className="h-4 w-4 shrink-0 text-fg-subtle" /> {r.toPath}
        </p>
        <p className="mt-1 text-xs text-fg-subtle">{r.status} {r.status === 301 || r.status === 308 ? "permanent" : "temporary"}{r.auto ? " · created automatically when a published URL changed" : ""}</p>
      </div>
      <StatusBadge tone={r.enabled ? "published" : "archived"}>{r.enabled ? "active" : "disabled"}</StatusBadge>
      {canWrite && (
        <div className="flex gap-2">
          <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => run(() => toggleRedirectAction(r.id, !r.enabled))}>
            {r.enabled ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={buttonStyles.danger}
            onClick={async () => {
              if (await confirm({ title: "Delete this redirect?", body: `${r.fromPath} will stop redirecting.`, confirmLabel: "Delete", danger: true })) run(() => deleteRedirectAction(r.id));
            }}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

export function RedirectManager({ items, canWrite }: { items: RedirectItem[]; canWrite: boolean }) {
  const [state, action, pending] = useToastAction(saveRedirectAction);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-8">
      {canWrite && (
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
          className="surface space-y-4 rounded-3xl p-6"
          aria-busy={pending}
        >
          <h2 className="font-display text-2xl">Add a redirect</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="From (old path)" name="fromPath" required placeholder="/old-page" help="An internal path starting with /. The admin, API and media areas are reserved." />
            <TextField label="To (new location)" name="toPath" required placeholder="/new-page" help="An internal path, or a full https:// URL." />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Type" htmlFor="redirect-status">
              <select id="redirect-status" name="status" defaultValue="301" className={control}>
                <option value="301">301 Permanent (recommended for moved pages)</option>
                <option value="308">308 Permanent (keeps the request method)</option>
                <option value="302">302 Temporary</option>
                <option value="307">307 Temporary (keeps the request method)</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" /> Active
            </label>
            <SubmitButton pending={pending}>Add redirect</SubmitButton>
          </div>
          <StatusLine state={state} />
        </form>
      )}
      {items.length === 0 ? (
        <p className="surface rounded-3xl border-dashed p-10 text-center text-sm text-fg-muted">
          No redirects yet. They are also created automatically when you change the URL of a published project.
        </p>
      ) : (
        <ul className="surface divide-y divide-line rounded-3xl">
          {items.map((r) => (
            <Row key={r.id} r={r} canWrite={canWrite} />
          ))}
        </ul>
      )}
    </div>
  );
}
