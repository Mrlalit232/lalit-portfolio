import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/primitives";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const btn = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60";
export const buttonStyles = {
  primary: `${btn} bg-fg text-ink-950 hover:opacity-90`,
  secondary: `${btn} border border-line-strong hover:bg-white/[0.06]`,
  ghost: `${btn} text-fg-muted hover:bg-white/[0.06] hover:text-fg`,
  danger: `${btn} border border-red-500/40 text-red-400 hover:bg-red-500/10`,
};

export function LinkButton({ href, variant = "primary", children }: { href: string; variant?: keyof typeof buttonStyles; children: ReactNode }) {
  return (
    <Link prefetch={false} href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}

const tones = {
  published: "border-tech/40 text-tech",
  draft: "border-business/40 text-business",
  archived: "border-line-strong text-fg-muted",
  trash: "border-red-500/40 text-red-400",
  neutral: "border-line-strong text-fg-muted",
} as const;

export function StatusBadge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px]", tones[tone])}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="surface rounded-3xl border-dashed p-10 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-white/[0.06]", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
