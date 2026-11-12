import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/data/types";
import { Badge } from "@/components/ui/primitives";

const categoryAccent: Record<string, "tech" | "business" | "creative"> = {
  "AI & Software": "creative",
  "Web Platforms": "tech",
  "Personal Brand": "business",
};

export function ProjectCard({ project, index }: { project: Project; index?: number }) {
  return (
    <article className="surface surface-hover group relative flex h-full flex-col overflow-hidden rounded-3xl p-6 sm:p-7 hover:-translate-y-1">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-tech/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="flex items-center justify-between gap-3">
        <Badge accent={categoryAccent[project.category] ?? "tech"}>{project.category}</Badge>
        {index !== undefined && (
          <span aria-hidden className="font-mono text-xs text-fg-subtle">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>
      <h3 className="mt-6 font-display text-3xl leading-tight text-fg">
        <Link
          href={`/projects/${project.slug}`}
          className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-3xl"
        >
          {project.title}
        </Link>
      </h3>
      <p className="mt-2 text-sm font-medium text-fg">{project.tagline}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">{project.summary}</p>
      <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Technology stack">
        {project.stack.map((s) => (
          <li key={s} className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-fg-muted">
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="text-fg-subtle">{project.status}</span>
        <span className="inline-flex items-center gap-1 text-fg transition-colors group-hover:text-tech">
          Case study
          <ArrowUpRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </article>
  );
}
