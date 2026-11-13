"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { verifyTwoFactorAction } from "../actions";
import type { LoginState } from "../actions";

const input =
  "w-full rounded-xl border border-line-strong bg-ink-900 px-4 py-3 text-base tracking-widest text-fg placeholder:text-fg-subtle focus-visible:border-tech focus-visible:outline-2";

export function VerifyForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(verifyTwoFactorAction, {});
  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      {state.error && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-business/40 bg-business/10 p-4 text-sm text-fg">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-business" />
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="code" className="mb-2 block text-sm font-medium">
          Authentication or recovery code
        </label>
        <input id="code" name="code" inputMode="text" autoComplete="one-time-code" autoFocus required maxLength={20} className={input} placeholder="123456" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fg px-6 py-3 text-sm font-medium text-ink-950 transition-all hover:bg-white disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Verifying…
          </>
        ) : (
          "Verify and sign in"
        )}
      </button>
      <p className="text-center text-sm text-fg-muted">
        <Link href="/admin/login" className="underline hover:text-fg">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
