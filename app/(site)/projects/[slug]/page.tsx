import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProject, getProjects } from "@/lib/content/public";
import { buildMetadata, projectJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/ui/JsonLd";
import { CaseStudy } from "@/components/projects/CaseStudy";

/**
 * Known (published) slugs are prerendered, so their <title>, description and Open Graph tags are in <head> for
 * every client. Slugs published after the build render on demand; proxy.ts returns a real 404 for slugs that are
 * not published, so a "not found" result is never cached for a slug that is about to be published.
 */
export async function generateStaticParams() {
  return (await getProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return buildMetadata({
    title: `${project.title}: Case Study`,
    description: project.summary,
    path: `/projects/${project.slug}`,
  });
}


/**
 * Case studies are managed in the CMS; the data comes from the tagged cache and is invalidated when content is
 * published or unpublished. Suspense keeps the page shell streaming-friendly.
 */
export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <ProjectBody params={params} />
    </Suspense>
  );
}

async function ProjectBody({ params }: { params: PageProps<"/projects/[slug]">["params"] }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const projects = await getProjects();
  const index = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(index + 1) % projects.length];

  return (
    <>
      <JsonLd data={projectJsonLd(project)} />
      <CaseStudy project={project} next={next} />
    </>
  );
}
