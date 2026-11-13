import { pageMetadata } from "@/lib/content/page-seo";
import { getProjects } from "@/lib/content/public";
import { PageHero } from "@/components/ui/primitives";
import { Container } from "@/components/ui/primitives";
import { ProjectExplorer } from "@/components/projects/ProjectExplorer";
import { ContactCta, RelatedLinks } from "@/components/sections/shared";

export async function generateMetadata() {
  return pageMetadata({
  title: "Projects: Web Development & Testing",
  description:
    "Projects by Lalit Kumar Saini: GenIQ, a local-first AI document workbench; the BHIM Coaching Center platform; and this Next.js portfolio.",
  path: "/projects",
  });
}

export default async function ProjectsPage() {
  const projects = await getProjects();
  const projectCategories = ["All", ...Array.from(new Set(projects.map((p) => p.category)))];
  return (
    <>
      <PageHero
        crumb={{ name: "Projects", path: "/projects" }}
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
      <RelatedLinks links={[{ href: "/skills", label: "Skills and technologies", hint: "The skills and tools used across these projects." },{ href: "/ventures", label: "Ventures", hint: "Entrepreneurial initiatives and their honest status." },{ href: "/services", label: "Services", hint: "Hire me to build a website for your business." }]} />
      <ContactCta title="Have a project in mind?" body="I am open to employment opportunities and website projects." />
    </>
  );
}
