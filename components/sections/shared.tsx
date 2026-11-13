import Link from "next/link";
import { Briefcase, GraduationCap, Award, Users, Trophy } from "lucide-react";
import type { Credential, Experience, Service, SkillGroup } from "@/data/types";
import { Badge, ButtonLink, CheckList, Container, accentDot, cn } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";

/* ---------------- Experience ---------------- */
export function ExperienceCard({ item, detailed = false }: { item: Experience; detailed?: boolean }) {
  return (
    <article className="surface rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line-strong bg-business/10 text-business">
            <Briefcase aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-3xl text-fg">{item.company}</h3>
            <p className="mt-1 text-fg">{item.role}</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-fg-muted">{item.period}</p>
          <p className="mt-1 text-fg-subtle">{item.duration}</p>
        </div>
      </div>
      <p className="mt-6 max-w-3xl leading-relaxed text-fg-muted">{item.summary}</p>
      <div className={cn("mt-8 grid gap-8", detailed ? "md:grid-cols-2" : "sm:grid-cols-2")}>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">Responsibilities</h4>
          <div className="mt-4">
            <CheckList items={item.responsibilities} accent="business" />
          </div>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">Transferable skills</h4>
          <ul className="mt-4 flex flex-wrap gap-2">
            {item.transferable.map((t) => (
              <li key={t}>
                <Badge accent="business">{t}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Skills ---------------- */
export function SkillGroups({ groups, compact = false }: { groups: SkillGroup[]; compact?: boolean }) {
  return (
    <Stagger className="grid gap-5 md:grid-cols-2">
      {groups.map((g) => (
        <StaggerItem key={g.id}>
          <section aria-labelledby={`skills-${g.id}`} className="surface h-full rounded-3xl p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span aria-hidden className={cn("h-2 w-2 rounded-full", accentDot[g.accent])} />
              <h3 id={`skills-${g.id}`} className="font-display text-2xl text-fg">
                {g.title}
              </h3>
            </div>
            {!compact && <p className="mt-2 text-sm text-fg-muted">{g.blurb}</p>}
            <ul className="mt-5 flex flex-wrap gap-2">
              {g.skills.map((s) => (
                <li
                  key={s.name}
                  title={s.level}
                  className="rounded-xl border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-fg"
                >
                  {s.name}
                  {!compact && <span className="sr-only"> ({s.level})</span>}
                </li>
              ))}
            </ul>
          </section>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* ---------------- Credentials ---------------- */
const kindIcon = {
  Education: GraduationCap,
  Certification: Award,
  Participation: Trophy,
  Activity: Users,
} as const;

export function CredentialGrid({ items }: { items: Credential[] }) {
  return (
    <Stagger>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => {
          const Icon = kindIcon[c.kind];
          return (
            <li key={c.title}>
              <StaggerItem className="h-full">
                <div className="surface surface-hover h-full rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-creative/10 text-creative">
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-fg-subtle">{c.kind}</span>
                  </div>
                  <h3 className="mt-4 font-medium leading-snug text-fg">{c.title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{c.issuer}</p>
                  {c.note && <p className="mt-2 text-sm text-fg-subtle">{c.note}</p>}
                </div>
              </StaggerItem>
            </li>
          );
        })}
      </ul>
    </Stagger>
  );
}

/* ---------------- Services ---------------- */
export function ServiceGrid({ items, preview = false }: { items: Service[]; preview?: boolean }) {
  return (
    <Stagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <StaggerItem key={s.id} className="h-full">
          <article id={s.id} className="surface surface-hover flex h-full scroll-mt-28 flex-col rounded-3xl p-6">
            <h3 className="font-display text-2xl text-fg">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{s.summary}</p>
            {!preview && (
              <>
                <div className="mt-5">
                  <CheckList items={s.includes} accent="business" />
                </div>
                <p className="mt-5 flex-1 border-t border-line pt-4 text-sm text-fg-subtle">
                  <span className="text-fg-muted">Ideal for: </span>
                  {s.idealFor}
                </p>
                <div className="mt-5">
                  <ButtonLink href={`/contact?type=project&service=${s.id}`} variant="secondary">
                    Enquire about this
                  </ButtonLink>
                </div>
              </>
            )}
          </article>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* ---------------- Testimonials ---------------- */
export function TestimonialGrid({ items }: { items: { name: string; designation: string; organization: string; text: string }[] }) {
  return (
    <Stagger className="grid gap-5 md:grid-cols-2">
      {items.map((t) => (
        <StaggerItem key={`${t.name}-${t.organization}`} className="h-full">
          <figure className="surface h-full rounded-3xl p-6">
            <blockquote className="leading-relaxed text-fg">&ldquo;{t.text}&rdquo;</blockquote>
            <figcaption className="mt-5 text-sm">
              <span className="font-medium text-fg">{t.name}</span>
              <span className="text-fg-muted">
                {" "}
                · {t.designation}, {t.organization}
              </span>
            </figcaption>
          </figure>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* ---------------- Contact CTA ---------------- */
export function ContactCta({
  title = "Let's build something useful.",
  body = "Whether you're hiring, planning a website or exploring a collaboration, I'd like to hear about it.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section aria-labelledby="cta-heading" className="py-16 sm:py-24">
      <Container>
        <Reveal>
          <div className="surface relative isolate overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20">
            <div aria-hidden className="aurora absolute inset-0 -z-10 opacity-80" />
            <h2 id="cta-heading" className="mx-auto max-w-2xl font-display text-4xl leading-tight text-fg sm:text-5xl">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-fg-muted sm:text-lg">{body}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/contact?type=employment">Employment enquiry</ButtonLink>
              <ButtonLink href="/contact?type=project" variant="secondary">
                Start a project
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}


/** Contextual internal links between related pages (descriptive anchor text, no repeated targets). */
export function RelatedLinks({ links }: { links: { href: string; label: string; hint: string }[] }) {
  return (
    <section aria-labelledby="related-heading" className="border-t border-line py-12 sm:py-16">
      <Container>
        <h2 id="related-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">
          Keep exploring
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="surface surface-hover block rounded-2xl p-5">
                <span className="font-medium text-fg">{l.label}</span>
                <span className="mt-1 block text-sm text-fg-muted">{l.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
