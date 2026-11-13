"use client";

import { LazyMotion, MotionConfig, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Makes every Motion animation honour the user's reduced-motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={() => import("./motion-features").then((mod) => mod.default)}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Scroll-triggered reveal. Renders static content when reduced motion is requested. */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 18,
  eager = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
  /** Above-the-fold content: animate with CSS only so it is visible before JavaScript loads. */
  eager?: boolean;
}) {
  const reduce = useReducedMotion();
  if (eager)
    return (
      <div className={`fade-up ${className ?? ""}`} style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    );
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

/** Staggered list container; wrap children in <StaggerItem>. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </m.div>
  );
}

/** Soft fade/slide used on route changes (see app/template.tsx). */
export function PageTransition({ children }: { children: ReactNode }) {
  // CSS-only (see .page-in in globals.css): the page must be visible in the server-rendered HTML,
  // not hidden until JavaScript hydrates. Reduced motion is handled by the global media query.
  return <div className="page-in">{children}</div>;
}
