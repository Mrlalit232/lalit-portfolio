"use client";

import { Container } from "@/components/ui/primitives";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="grid min-h-[70vh] place-items-center pt-24 text-center">
      <div role="alert">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-business">Something went wrong</p>
        <h1 className="mt-4 font-display text-4xl text-fg sm:text-5xl">This page failed to load.</h1>
        <p className="mx-auto mt-4 max-w-md text-fg-muted">Please try again. If the problem continues, reload the page.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-full bg-fg px-5 py-3 text-sm font-medium text-ink-950 transition-all hover:bg-white"
        >
          Try again
        </button>
      </div>
    </Container>
  );
}
