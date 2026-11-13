import { buildMetadata } from "@/lib/seo";
import { proficiencyNote } from "@/data/skills";
import { getCredentials, getSkillGroups } from "@/lib/content/public";
import { PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { ContactCta, CredentialGrid, SkillGroups, RelatedLinks } from "@/components/sections/shared";

export const metadata = buildMetadata({
  title: "Skills: QA Testing, Python & Web Dev",
  description:
    "Skills of Lalit Kumar Saini across web development, QA and test automation, business operations, and digital productivity, plus certifications.",
  path: "/skills",
});

const levels = [
  ["Applied in work", "Used in a real job."],
  ["Applied in projects", "Used in projects I built."],
  ["Working knowledge", "Studied and practised."],
  ["Learning & practising", "Actively building proficiency."],
];

export default async function SkillsPage() {
  const [credentials, skillGroups] = await Promise.all([getCredentials(), getSkillGroups()]);
  return (
    <>
      <PageHero
        crumb={{ name: "Skills", path: "/skills" }}
        eyebrow="Skills & expertise"
        title={
          <>
            Skills, described by <em className="text-gradient">how I have used them</em>.
          </>
        }
        description={proficiencyNote}
      />

      <Section labelledBy="groups-heading">
        <h2 id="groups-heading" className="sr-only">
          Skill groups
        </h2>
        <SkillGroups groups={skillGroups} />
        <Reveal className="mt-10">
          <dl className="grid gap-4 rounded-3xl border border-line p-6 sm:grid-cols-2 lg:grid-cols-4">
            {levels.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-medium text-fg">{k}</dt>
                <dd className="mt-1 text-sm text-fg-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Section>

      <Section labelledBy="cred-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="Certifications & achievements"
            accent="creative"
            title={<span id="cred-heading">Learning and participation.</span>}
            description="Education, certifications and activities. Participation is listed as participation, not as an award."
          />
        </Reveal>
        <div className="mt-12">
          <CredentialGrid items={credentials} />
        </div>
      </Section>

      <RelatedLinks links={[{ href: "/projects", label: "Projects", hint: "See web development skills applied in real project case studies." },{ href: "/experience", label: "Experience", hint: "Where client handling and operations skills were applied at work." },{ href: "/services", label: "Services", hint: "Website development and digital marketing support." }]} />
      <ContactCta />
    </>
  );
}
