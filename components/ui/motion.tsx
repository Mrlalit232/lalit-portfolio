import type { ReactNode } from "react";

/**
 * Entrance animations, implemented in CSS only (see globals.css): no animation library and no client JavaScript.
 *  - Below the fold: scroll-driven reveal (`animation-timeline: view()`). Browsers without support simply show the
 *    content, so nothing is ever hidden waiting for JavaScript.
 *  - Above the fold (`eager`): a short time-based fade that never delays first paint.
 * `prefers-reduced-motion` disables all of it.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  eager = false,
}: {
  children: ReactNode;
  /** Seconds. Applies to `eager` (time-based) reveals only. */
  delay?: number;
  className?: string;
  /** Above-the-fold content: animate by time instead of scroll position. */
  eager?: boolean;
}) {
  if (eager)
    return (
      <div className={`fade-up ${className ?? ""}`} style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    );
  return <div className={`reveal ${className ?? ""}`}>{children}</div>;
}

/** Container for a group of <StaggerItem>s (each reveals as it scrolls into view). */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`reveal ${className ?? ""}`}>{children}</div>;
}

/** Soft fade/slide on route changes (see app/(site)/template.tsx). CSS-only so the page is visible in the server HTML. */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="page-in">{children}</div>;
}
