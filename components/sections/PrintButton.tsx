"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="group inline-flex items-center justify-center gap-2 rounded-full border border-line-strong bg-white/[0.03] px-5 py-3 text-sm font-medium text-fg transition-all hover:border-tech/60 hover:bg-white/[0.07]"
    >
      <Printer aria-hidden className="h-4 w-4" />
      Print resume
    </button>
  );
}
