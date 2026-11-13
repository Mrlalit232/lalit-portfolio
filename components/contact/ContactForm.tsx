"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert, Mail } from "lucide-react";
import { submitContact } from "@/app/(site)/contact/actions";
import { initialContactState, inquiryTypes } from "@/lib/contact";
import { cn } from "@/components/ui/primitives";

const inputCls =
  "w-full rounded-xl border border-line-strong bg-ink-900 px-4 py-3 text-base text-fg placeholder:text-fg-subtle transition-colors focus-visible:border-tech focus-visible:outline-2 aria-[invalid=true]:border-business";

export function ContactForm() {
  const params = useSearchParams();
  const uid = useId();
  const [state, action, pending] = useActionState(submitContact, initialContactState);
  const startedAtRef = useRef(0);

  // Timestamp for the minimum-fill-time spam check. Set on the client only.
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const requested = params.get("type");
  const defaultType = inquiryTypes.some((t) => t.value === requested) ? requested! : "employment";
  const v = state.status === "error" || state.status === "unconfigured" ? (state.values ?? {}) : {};
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const id = (n: string) => `${uid}-${n}`;

  if (state.status === "success") {
    return (
      <div role="status" className="surface rounded-3xl p-8 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-tech" />
        <h2 className="mt-4 font-display text-3xl text-fg">Message received</h2>
        <p className="mt-2 text-fg-muted">{state.message}</p>
      </div>
    );
  }

  const field = (name: keyof typeof errors, label: string, children: React.ReactNode, optional = false) => (
    <div>
      <label htmlFor={id(name)} className="mb-2 block text-sm font-medium text-fg">
        {label}
        {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
      </label>
      {children}
      {errors[name] && (
        <p id={id(`${name}-err`)} className="mt-2 text-sm text-business">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const aria = (name: keyof typeof errors) => ({
    id: id(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? id(`${name}-err`) : undefined,
  });

  return (
    <form
      action={(fd) => {
        fd.set("startedAt", String(startedAtRef.current));
        action(fd);
      }}
      noValidate className="surface space-y-5 rounded-3xl p-6 sm:p-8" aria-busy={pending}>
      {(state.status === "error" || state.status === "unconfigured") && (
        <div
          role="alert"
          className={cn(
            "flex gap-3 rounded-2xl border p-4 text-sm",
            state.status === "unconfigured" ? "border-business/40 bg-business/10" : "border-business/40 bg-business/10",
          )}
        >
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-business" />
          <div>
            <p className="text-fg">{state.message}</p>
            {state.status === "unconfigured" && state.mailto && (
              <a
                href={state.mailto}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-fg px-4 py-2 font-medium text-ink-950"
              >
                <Mail aria-hidden className="h-4 w-4" /> Send by email instead
              </a>
            )}
          </div>
        </div>
      )}

      {field(
        "type",
        "What is this about?",
        <select {...aria("type")} key={v.type ?? defaultType} defaultValue={v.type ?? defaultType} className={inputCls}>
          {inquiryTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>,
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "name",
          "Your name",
          <input {...aria("name")} type="text" autoComplete="name" required defaultValue={v.name} className={inputCls} />,
        )}
        {field(
          "email",
          "Email address",
          <input {...aria("email")} type="email" autoComplete="email" required defaultValue={v.email} className={inputCls} />,
        )}
      </div>

      {field(
        "company",
        "Company or organisation",
        <input {...aria("company")} type="text" autoComplete="organization" defaultValue={v.company} className={inputCls} />,
        true,
      )}

      {field(
        "message",
        "Message",
        <textarea
          {...aria("message")}
          rows={6}
          required
          defaultValue={v.message}
          placeholder="Tell me about the role, project or idea."
          className={cn(inputCls, "resize-y")}
        />,
      )}

      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fg px-6 py-3.5 text-sm font-medium text-ink-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send message"
        )}
      </button>
    </form>
  );
}
