"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import type { FormState } from "@/app/admin/(protected)/_actions/features";
import { cn } from "@/components/ui/primitives";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

export const control =
  "w-full rounded-xl border border-line-strong bg-ink-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-tech focus-visible:outline-2 aria-[invalid=true]:border-red-500";

/** useActionState + a toast for every result + a router refresh on success. */
export function useToastAction(action: (prev: FormState, fd: FormData) => Promise<FormState>, opts: { refresh?: boolean } = { refresh: true }) {
  const { toast } = useAdminUi();
  const router = useRouter();
  const wrapped = async (prev: FormState, fd: FormData): Promise<FormState> => {
    let result: FormState;
    try {
      result = await action(prev, fd);
    } catch {
      result = { status: "error", message: "That action failed. Please try again." };
    }
    if (result.status === "ok") {
      toast("success", result.message);
      if (opts.refresh) router.refresh();
    } else if (result.status === "error") toast("error", result.message);
    return result;
  };
  return useActionState<FormState, FormData>(wrapped, { status: "idle" });
}

export function Field({ label, help, children, htmlFor }: { label: string; help?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {help && <p className="mt-1.5 text-xs text-fg-subtle">{help}</p>}
    </div>
  );
}

export function TextField({ label, name, help, defaultValue, type = "text", required, autoComplete, placeholder, maxLength }: {
  label: string; name: string; help?: string; defaultValue?: string; type?: string; required?: boolean; autoComplete?: string; placeholder?: string; maxLength?: number;
}) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <input id={id} name={name} type={type} defaultValue={defaultValue} required={required} autoComplete={autoComplete} placeholder={placeholder} maxLength={maxLength} className={control} />
    </Field>
  );
}

export function SubmitButton({ pending, children, variant = "primary" }: { pending: boolean; children: ReactNode; variant?: keyof typeof buttonStyles }) {
  return (
    <button type="submit" disabled={pending} className={buttonStyles[variant]}>
      {pending && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function StatusLine({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={cn("text-sm", state.status === "error" ? "text-red-400" : "text-tech")}>
      {state.message}
    </p>
  );
}

/** Recovery codes: shown once, with copy and download so they can be stored safely. */
export function CodesBox({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="rounded-2xl border border-business/40 bg-business/10 p-4">
      <p className="text-sm font-medium">Recovery codes (each works once)</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-ink-900 px-3 py-1.5">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
        <a className={buttonStyles.secondary} href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Portfolio admin recovery codes\n\n${text}\n`)}`} download="portfolio-recovery-codes.txt">
          <Download aria-hidden className="h-4 w-4" /> Download
        </a>
      </div>
      <p className="mt-3 text-xs text-fg-muted">Store them somewhere safe (a password manager). They will not be shown again.</p>
    </div>
  );
}
