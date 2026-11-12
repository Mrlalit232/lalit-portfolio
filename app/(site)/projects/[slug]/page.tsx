import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import { getProject, getProjects } from "@/lib/content/public";
import { buildMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";
import { Badge, ButtonLink, CheckList, Container, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { ContactCta } from "@/components/sections/shared";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  // Request-time on purpose: a project published after the build must never get a stale "not found" head.
  await connection();
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return buildMetadata({
    title: `${project.title}: Case Study`,
    description: project.summary,
    path: `/projects/${project.slug}`,
  });
}

function Block({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section aria-labelledby={`s-${n}`} className="grid gap-4 border-t border-line py-10 md:grid-cols-[14rem_1fr] md:gap-10">
        <div>
          <p className="font-mono text-xs text-tech">{n}</p>
          <h2 id={`s-${n}`} className="mt-1 font-display text-2xl text-fg">
            {title}
          </h2>
        </div>
        <div className="space-y-4 leading-relaxed text-fg-muted">{children}</div>
      </section>
    </Reveal>
  );
}

const paras = (items: string[]) => items.map((t) => <p key={t}>{t}</p>);

/**
 * Case studies are managed in the CMS, so each one is resolved per request (the data itself still comes
 * from the tagged cache). The static shell therefore never contains project-specific content, which avoids
 * caching a "not found" shell for slugs created after the build. proxy.ts returns a real HTTP 404 for
 * unknown slugs before this page renders.
 */
export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <ProjectBody params={params} />
    </Suspense>
  );
}

async function ProjectBody({ params }: { params: PageProps<"/projects/[slug]">["params"] }) {
  await connection();
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const { caseStudy: cs } = project;
  // Sequential section numbers, so an omitted section never leaves a gap.
  let counter = 0;
  const num = () => String(++counter).padStart(2, "0");
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(index + 1) % projects.length];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    author: { "@type": "Person", name: site.name },
    url: absoluteUrl(`/projects/${project.slug}`),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="relative isolate overflow-hidden border-b border-line pb-14 pt-32 sm:pb-20 sm:pt-40">
        <div aria-hidden className="aurora absolute inset-0 -z-10" />
        <div aria-hidden className="grid-bg absolute inset-0 -z-10" />
        <Container>
          <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-fg">
            <ArrowLeft aria-hidden className="h-4 w-4" /> All projects
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge accent="creative">{project.category}</Badge>
            <Badge>{project.status}</Badge>
          </div>
          <h1 className="mt-5 font-display text-5xl leading-[1.02] tracking-tight text-fg sm:text-7xl">{project.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted sm:text-xl">{project.tagline}</p>
          {project.links.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {project.links.map((l) => (
                <ButtonLink key={l.href} href={l.href} variant={l.label === "Live demo" ? "primary" : "secondary"}>
                  {l.label}
                </ButtonLink>
              ))}
            </div>
          )}
        </Container>
      </header>

      <Section className="!py-10 sm:!py-14">
        <Block n={num()} title="Overview">
          {paras(cs.overview)}
        </Block>
        <Block n={num()} title="Problem or objective">
          {paras(cs.objective)}
        </Block>
        <Block n={num()} title="Proposed solution">
          {paras(cs.solution)}
        </Block>
        <Block n={num()} title="My role">
          {paras(cs.role)}
        </Block>
        <Block n={num()} title="Technology stack">
          <ul className="flex flex-wrap gap-2">
            {project.stack.map((s) => (
              <li key={s}>
                <Badge accent="tech">{s}</Badge>
              </li>
            ))}
          </ul>
        </Block>
        <Block n={num()} title="Implementation approach">
          <CheckList items={cs.implementation} />
          {project.architecture && (
            <figure className="mt-8">
              <figcaption className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">
                Architecture overview
              </figcaption>
              <ol className="grid gap-2 sm:grid-cols-5">
                {project.architecture.map((a, i) => (
                  <li key={a.label} className="surface relative rounded-2xl p-4">
                    <span className="font-mono text-[11px] text-tech">{String(i + 1).padStart(2, "0")}</span>
                    <p className="mt-1 text-sm font-medium text-fg">{a.label}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{a.detail}</p>
                    {i < project.architecture!.length - 1 && (
                      <ArrowRight aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-fg-subtle sm:block" />
                    )}
                  </li>
                ))}
              </ol>
            </figure>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line p-5">
              <h3 className="text-sm font-medium text-fg">Built today</h3>
              <div className="mt-3">
                <CheckList items={cs.implemented} accent="tech" />
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-line-strong p-5">
              <h3 className="text-sm font-medium text-fg">Planned / not claimed</h3>
              <div className="mt-3">
                <CheckList items={cs.planned} accent="business" />
              </div>
            </div>
          </div>
        </Block>
        {cs.challenges && cs.challenges.length > 0 && (
          <Block n={num()} title="Challenges">
            <CheckList items={cs.challenges} accent="business" />
          </Block>
        )}
        <Block n={num()} title="Screenshots & visuals">
          {project.screenshots.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {project.screenshots.map((s) => (
                <Image key={s.src} src={s.src} alt={s.alt} width={1280} height={800} className="rounded-2xl border border-line" />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line-strong p-6">
              <ImageOff aria-hidden className="h-6 w-6 shrink-0 text-fg-subtle" />
              <p className="text-sm">
                Screenshots have not been added yet.
                {project.links.some((l) => l.label === "Live demo") && " The live demo above shows the current build."}
              </p>
            </div>
          )}
        </Block>
        <Block n={num()} title="Links">
          {project.links.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {project.links.map((l) => (
                <li key={l.href}>
                  <ButtonLink href={l.href} variant="secondary">
                    {l.label}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          ) : (
            <p>No public demo or repository link is available for this project yet.</p>
          )}
        </Block>
        <Block n={num()} title="Future improvements">
          <CheckList items={cs.future} accent="creative" />
        </Block>

        <div className="border-t border-line pt-10">
          <Link
            href={`/projects/${next.slug}`}
            className="surface surface-hover group flex items-center justify-between rounded-3xl p-6"
          >
            <span>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">Next project</span>
              <span className="mt-1 block font-display text-3xl text-fg">{next.title}</span>
            </span>
            <ArrowRight aria-hidden className="h-6 w-6 text-fg-muted transition-transform group-hover:translate-x-1 group-hover:text-tech" />
          </Link>
        </div>
      </Section>

      <ContactCta />
    </>
  );
}
