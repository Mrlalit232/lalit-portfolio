import { buildMetadata } from "@/lib/seo";
import { projectCategories, projects } from "@/data/projects";
import { PageHero } from "@/components/ui/primitives";
import { Container } from "@/components/ui/primitives";
import { ProjectExplorer } from "@/components/projects/ProjectExplorer";
import { ContactCta } from "@/components/sections/shared";

export const metadata = buildMetadata({
  title: "Projects",
  description:
    "Projects by Lalit Kumar Saini: GenIQ, a local-first AI document workbench; the BHIM Coaching Center platform; and this Next.js portfolio.",
  path: "/projects",
});

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        eyebrow="Projects"
        title={
          <>
            Things I have <em className="text-gradient">built</em>.
          </>
        }
        description="Every project has a case study covering the objective, my role, the stack and what is built versus still planned."
      />
      <Container className="py-16 sm:py-24">
        <ProjectExplorer projects={projects} categories={projectCategories} />
      </Container>
      <ContactCta title="Have a project in mind?" body="I am open to employment opportunities and website projects." />
    </>
  );
}
