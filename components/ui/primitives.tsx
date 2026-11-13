import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Container({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "header" | "footer";
}) {
  return <Tag className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</Tag>;
}

export function Eyebrow({ children, accent = "tech" }: { children: ReactNode; accent?: Accent }) {
  return (
    <p className={cn("font-mono text-xs uppercase tracking-[0.18em]", accentText[accent])}>
      <span aria-hidden className="mr-2 inline-block h-px w-6 translate-y-[-3px] bg-current align-middle opacity-60" />
      {children}
    </p>
  );
}

export type Accent = "tech" | "business" | "creative";

export const accentText: Record<Accent, string> = {
  tech: "text-tech",
  business: "text-business",
  creative: "text-creative",
};

export const accentDot: Record<Accent, string> = {
  tech: "bg-tech",
  business: "bg-business",
  creative: "bg-creative",
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  accent,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  as?: "h1" | "h2";
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <Eyebrow accent={accent}>{eyebrow}</Eyebrow>}
      <Tag className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl">{title}</Tag>
      {description && <p className="mt-4 text-base leading-relaxed text-fg-muted sm:text-lg">{description}</p>}
    </div>
  );
}

export function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-16 sm:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonBase =
  "group inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-2";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-fg text-ink-950 hover:bg-white hover:shadow-[0_0_0_4px_rgb(108_199_255/0.18)]",
  secondary: "border border-line-strong bg-white/[0.03] text-fg hover:border-tech/60 hover:bg-white/[0.07]",
  ghost: "text-fg-muted hover:text-fg",
};

export function ButtonLink({
  href,
  variant = "primary",
  children,
  external,
  className,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
  external?: boolean;
  className?: string;
} & Omit<ComponentProps<"a">, "href">) {
  const cls = cn(buttonBase, buttonVariants[variant], className);
  if (external || href.startsWith("mailto:") || href.startsWith("http") || href.endsWith(".pdf")) {
    return (
      <a
        href={href}
        className={cls}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...rest}
      >
        {children}
        {href.startsWith("http") && <ArrowUpRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

export function Badge({ children, accent }: { children: ReactNode; accent?: Accent }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-fg-muted">
      {accent && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", accentDot[accent])} />}
      {children}
    </span>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  accent,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  accent?: Accent;
  children?: ReactNode;
}) {
  return (
    <header className="relative isolate overflow-hidden border-b border-line pb-14 pt-32 sm:pb-20 sm:pt-40">
      <div aria-hidden className="aurora absolute inset-0 -z-10" />
      <div aria-hidden className="grid-bg absolute inset-0 -z-10" />
      <Container>
        <SectionHeading as="h1" eyebrow={eyebrow} title={title} description={description} accent={accent} />
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </header>
  );
}

export function CheckList({ items, accent = "tech" }: { items: string[]; accent?: Accent }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed text-fg-muted sm:text-base">
          <span aria-hidden className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", accentDot[accent])} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
