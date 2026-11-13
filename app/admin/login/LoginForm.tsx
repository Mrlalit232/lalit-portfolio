"use client";

import { useActionState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const input =
  "w-full rounded-xl border border-line-strong bg-ink-900 px-4 py-3 text-base text-fg placeholder:text-fg-subtle focus-visible:border-tech focus-visible:outline-2";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      {state.error && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-business/40 bg-business/10 p-4 text-sm text-fg">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-business" />
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fg px-6 py-3 text-sm font-medium text-ink-950 transition-all hover:bg-white disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
