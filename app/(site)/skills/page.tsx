import { buildMetadata } from "@/lib/seo";
import { credentials } from "@/data/credentials";
import { proficiencyNote, skillGroups } from "@/data/skills";
import { PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { ContactCta, CredentialGrid, SkillGroups } from "@/components/sections/shared";

export const metadata = buildMetadata({
  title: "Skills & Expertise",
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

export default function SkillsPage() {
  return (
    <>
      <PageHero
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

      <ContactCta />
    </>
  );
}
