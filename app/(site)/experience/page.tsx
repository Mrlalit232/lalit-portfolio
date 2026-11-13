import { pageMetadata } from "@/lib/content/page-seo";
import { activities } from "@/data/experience";
import { getExperience } from "@/lib/content/public";
import { PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { ContactCta, ExperienceCard, RelatedLinks } from "@/components/sections/shared";

export async function generateMetadata() {
  return pageMetadata({
  title: "Experience",
  description:
    "Professional experience of Lalit Kumar Saini: sales, marketing and operations at Red Hills Group, plus campus ambassador activity.",
  path: "/experience",
  });
}

export default async function ExperiencePage() {
  const experience = await getExperience();
  return (
    <>
      <PageHero
        crumb={{ name: "Experience", path: "/experience" }}
        eyebrow="Experience"
        accent="business"
        title={
          <>
            Real work with <em className="text-gradient">clients</em> and operations.
          </>
        }
        description="My professional experience is in sales, marketing and operations. It is not software engineering employment, and I present it as what it is."
      />

      <Section labelledBy="roles-heading">
        <h2 id="roles-heading" className="sr-only">
          Roles
        </h2>
        <div className="space-y-6">
          {experience.map((e) => (
            <Reveal key={e.company}>
              <ExperienceCard item={e} detailed />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section labelledBy="activity-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading eyebrow="Activities" accent="creative" title={<span id="activity-heading">Beyond work.</span>} />
        </Reveal>
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {activities.map((a) => (
            <li key={a.title} className="surface rounded-3xl p-6">
              <h3 className="font-display text-2xl text-fg">{a.title}</h3>
              <p className="mt-2 leading-relaxed text-fg-muted">{a.note}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="bridge-heading" className="border-t border-line">
        <Reveal>
          <SectionHeading
            eyebrow="Why it matters"
            title={<span id="bridge-heading">How business experience supports technical work.</span>}
            description="Understanding customers, following up reliably and coordinating with a team all carry over to building and testing software. They help me understand requirements, communicate progress and report issues clearly."
          />
        </Reveal>
      </Section>

      <RelatedLinks links={[{ href: "/skills", label: "Skills", hint: "The testing, web and business skills behind this experience." },{ href: "/projects", label: "Projects", hint: "Project work built alongside this experience." },{ href: "/resume", label: "Resume", hint: "A one-page summary you can download or print." }]} />
      <ContactCta />
    </>
  );
}
