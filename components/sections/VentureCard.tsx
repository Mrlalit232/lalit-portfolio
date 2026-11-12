import type { Venture } from "@/data/types";
import { ButtonLink, CheckList, cn } from "@/components/ui/primitives";

const stageStyle = {
  active: { dot: "bg-tech", text: "text-tech", border: "border-tech/40", label: "Active work" },
  concept: { dot: "bg-creative", text: "text-creative", border: "border-creative/40", label: "Concept" },
} as const;

export function StatusBadge({ venture }: { venture: Venture }) {
  const s = stageStyle[venture.stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-white/[0.03] px-3 py-1 font-mono text-xs",
        s.border,
        s.text,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      <span className="sr-only">Status: </span>
      {venture.status}
    </span>
  );
}

/** Compact card for the homepage preview. */
export function VentureCard({ venture, headingLevel: H = "h3" }: { venture: Venture; headingLevel?: "h2" | "h3" }) {
  return (
    <article className="surface surface-hover flex h-full flex-col rounded-3xl p-6">
      <StatusBadge venture={venture} />
      <H className="mt-5 font-display text-2xl text-fg">{venture.name}</H>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">{venture.tagline}</p>
      <p className="mt-4 flex-1 border-t border-line pt-4 text-sm text-fg-subtle">{venture.note}</p>
    </article>
  );
}

/** Full detail block for the /ventures page. */
export function VentureDetail({ venture }: { venture: Venture }) {
  return (
    <article
      id={venture.id}
      aria-labelledby={`${venture.id}-title`}
      className="surface scroll-mt-28 rounded-3xl p-6 sm:p-10"
    >
      <StatusBadge venture={venture} />
      <h3 id={`${venture.id}-title`} className="mt-5 font-display text-3xl text-fg sm:text-4xl">
        {venture.name}
      </h3>
      <p className="mt-2 text-lg text-fg">{venture.tagline}</p>
      <p className="mt-4 max-w-3xl leading-relaxed text-fg-muted">{venture.summary}</p>

      <div className={cn("mt-8 grid gap-8", venture.secondaryItems && "md:grid-cols-2")}>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">{venture.listTitle}</h4>
          <div className="mt-4">
            <CheckList items={venture.items} accent={venture.stage === "active" ? "tech" : "creative"} />
          </div>
        </div>
        {venture.secondaryItems && (
          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">{venture.secondaryTitle}</h4>
            <div className="mt-4">
              <CheckList items={venture.secondaryItems} accent="business" />
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-fg-muted">{venture.note}</p>
      {venture.link && (
        <div className="mt-6">
          <ButtonLink href={venture.link.href} variant="secondary">
            {venture.link.label}
          </ButtonLink>
        </div>
      )}
    </article>
  );
}
