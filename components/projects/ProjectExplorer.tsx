"use client";

import { useState } from "react";
import type { Project, ProjectCategory } from "@/data/types";
import { ProjectCard } from "./ProjectCard";
import { cn } from "@/components/ui/primitives";

export function ProjectExplorer({
  projects,
  categories,
}: {
  projects: Project[];
  categories: ("All" | ProjectCategory)[];
}) {
  const [active, setActive] = useState<"All" | ProjectCategory>("All");
  const visible = active === "All" ? projects : projects.filter((p) => p.category === active);

  return (
    <div>
      <div role="group" aria-label="Filter projects by category" className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const count = c === "All" ? projects.length : projects.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active === c}
              onClick={() => setActive(c)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                active === c
                  ? "border-tech/60 bg-tech/10 text-fg"
                  : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {c} <span className="ml-1 font-mono text-xs text-fg-subtle">{count}</span>
            </button>
          );
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? "project" : "projects"}
      </p>
      <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((p, i) => (
          <li key={p.slug}>
            <ProjectCard project={p} index={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}
