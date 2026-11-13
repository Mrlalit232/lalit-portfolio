"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { saveContentAction, type SaveState } from "@/app/admin/(protected)/_actions/content";
import type { FieldDef, FormValues } from "@/lib/content/codec";
import { cn } from "@/components/ui/primitives";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

const control =
  "w-full rounded-xl border border-line-strong bg-ink-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-tech focus-visible:outline-2 aria-[invalid=true]:border-red-500";

export function ContentForm({
  module,
  id,
  fields,
  initial,
  canPublish,
}: {
  module: string;
  id: string; // "new" | "singleton" | uuid
  fields: FieldDef[];
  initial: FormValues;
  canPublish: boolean;
}) {
  const { toast } = useAdminUi();
  // The toast is fired here, not in an effect: after a successful save the server re-renders this page and
  // re-keys the form, so this component can unmount before an effect would run and the message would be lost.
  const submit = async (prev: SaveState, formData: FormData): Promise<SaveState> => {
    const result = await saveContentAction(module, id, prev, formData);
    if (result.status === "ok") toast("success", result.message);
    else if (result.status === "error") toast("error", result.message);
    return result;
  };
  const [state, action, pending] = useActionState<SaveState, FormData>(submit, { status: "idle" });
  // "Dirty" = edited since the last server response; a failed save leaves the edits unsaved.
  const [editedAt, setEditedAt] = useState<SaveState | null>(null);
  const dirty = editedAt === state || state.status === "error";

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const values = state.status === "error" && state.values ? state.values : initial;
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  // A group heading is shown when a field starts a new group.
  const showGroupFor = new Set<string>();
  let seenGroup: string | undefined;
  for (const f of fields) {
    if (f.group && f.group !== seenGroup) showGroupFor.add(f.name);
    if (f.group) seenGroup = f.group;
  }

  return (
    <form action={action} onChange={() => setEditedAt(state)} noValidate aria-busy={pending} className="space-y-6">
      {dirty && (
        <p role="status" className="rounded-xl border border-business/40 bg-business/10 px-4 py-2 text-sm">
          You have unsaved changes.
        </p>
      )}
      {errors._form && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm">
          {errors._form}
        </p>
      )}

      {fields.map((f) => {
        const fid = `f-${f.name}`;
        const err = errors[f.name];
        const showGroup = showGroupFor.has(f.name);
        const describedBy = [f.help && `${fid}-help`, err && `${fid}-err`].filter(Boolean).join(" ") || undefined;
        const common = { id: fid, name: f.name, "aria-invalid": err ? true : undefined, "aria-describedby": describedBy, required: false } as const;
        const dv = values[f.name];

        return (
          <div key={f.name}>
            {showGroup && <h2 className="mb-4 mt-8 border-b border-line pb-2 font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle first:mt-0">{f.group}</h2>}
            {f.kind === "boolean" ? (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" {...common} defaultChecked={dv === true} className="h-4 w-4 accent-[var(--tech)]" />
                {f.label}
              </label>
            ) : (
              <>
                <label htmlFor={fid} className="mb-1.5 block text-sm font-medium">
                  {f.label}
                  {f.required && <span aria-hidden className="ml-1 text-business">*</span>}
                </label>
                {f.kind === "text" && <input type="text" {...common} defaultValue={String(dv ?? "")} placeholder={f.placeholder} className={control} />}
                {f.kind === "select" && (
                  <select {...common} defaultValue={String(dv ?? f.options?.[0]?.value ?? "")} className={control}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                {(f.kind === "textarea" || f.kind === "paragraphs" || f.kind === "lines" || f.kind === "tuples") && (
                  <textarea
                    {...common}
                    rows={f.rows ?? 4}
                    defaultValue={String(dv ?? "")}
                    placeholder={f.placeholder}
                    spellCheck={f.kind === "textarea" || f.kind === "paragraphs"}
                    className={cn(control, "resize-y", (f.kind === "lines" || f.kind === "tuples") && "font-mono text-[13px] leading-relaxed")}
                  />
                )}
              </>
            )}
            {f.help && (
              <p id={`${fid}-help`} className="mt-1.5 text-xs text-fg-subtle">
                {f.help}
              </p>
            )}
            {err && (
              <p id={`${fid}-err`} className="mt-1.5 text-sm text-red-400">
                {err}
              </p>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-ink-950/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <button type="submit" name="intent" value="save" disabled={pending} className={buttonStyles.secondary}>
          {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
          Save draft
        </button>
        {canPublish && (
          <button type="submit" name="intent" value="publish" disabled={pending} className={buttonStyles.primary}>
            Save &amp; publish
          </button>
        )}
        <p className="text-xs text-fg-subtle">Drafts are private. Nothing goes live until you publish.</p>
      </div>
    </form>
  );
}
