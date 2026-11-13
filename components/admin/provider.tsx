"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; message: string };
type ConfirmOptions = { title: string; body?: string; confirmLabel?: string; danger?: boolean };

type Ctx = {
  toast: (kind: Toast["kind"], message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UiContext = createContext<Ctx | null>(null);

export function useAdminUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useAdminUi must be used inside <AdminUiProvider>");
  return ctx;
}

/** Toast notifications and an accessible confirmation dialog (native <dialog>) for the whole admin area. */
export function AdminUiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const toast = useCallback((kind: Toast["kind"], message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4500);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  useEffect(() => {
    if (options) dialogRef.current?.showModal();
  }, [options]);

  const close = (result: boolean) => {
    dialogRef.current?.close();
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        aria-labelledby="confirm-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line-strong bg-ink-900 p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {options && (
          <div className="p-6">
            <h2 id="confirm-title" className="font-display text-2xl">
              {options.title}
            </h2>
            {options.body && <p className="mt-2 text-sm leading-relaxed text-fg-muted">{options.body}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => close(false)}
                className="rounded-full border border-line-strong px-4 py-2 text-sm hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={
                  options.danger
                    ? "rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
                    : "rounded-full bg-fg px-4 py-2 text-sm font-medium text-ink-950 hover:opacity-90"
                }
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line-strong bg-ink-900 p-4 text-sm shadow-xl"
          >
            {t.kind === "success" ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-tech" />
            ) : (
              <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-business" />
            )}
            <p className="flex-1 text-fg">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="text-fg-subtle hover:text-fg"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </UiContext.Provider>
  );
}
