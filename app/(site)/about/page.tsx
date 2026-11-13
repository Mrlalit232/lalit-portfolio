import { GraduationCap } from "lucide-react";
import { buildMetadata, profilePageJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/ui/JsonLd";
import { getProfile } from "@/lib/content/public";
import { Badge, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { ContactCta, RelatedLinks } from "@/components/sections/shared";

export const metadata = buildMetadata({
  title: "About: BCA Student, Web & QA",
  description:
    "About Lalit Kumar Saini: a BCA student focused on web development, software testing, automation, client communication and business operations.",
  path: "/about",
});

export default async function AboutPage() {
  const profile = await getProfile();
  return (
    <>
      <JsonLd data={profilePageJsonLd("/about", "About Lalit Kumar Saini")} />
      <PageHero
        crumb={{ name: "About", path: "/about" }}
        eyebrow="About"
        title={
          <>
            Curious about how things are built, and whether they <em className="text-gradient">work</em>.
          </>
        }
        description="A BCA student with web projects, a testing mindset and real experience working with clients and operations."
      />

      <Section labelledBy="story-heading">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <h2 id="story-heading" className="sr-only">
              My story
            </h2>
            <div className="space-y-6 text-lg leading-relaxed text-fg-muted">
              {profile.about.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <aside aria-label="Education" className="surface rounded-3xl p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-tech/10 text-tech">
                <GraduationCap aria-hidden className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-display text-2xl text-fg">Education</h2>
              <p className="mt-2 leading-relaxed text-fg-muted">{profile.about.education}</p>
            </aside>
          </Reveal>
        </div>
      </Section>

      <Section labelledBy="interests-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="What interests me"
            accent="creative"
            title={<span id="interests-heading">Where my attention goes.</span>}
          />
          <ul className="mt-10 flex flex-wrap gap-2.5">
            {profile.about.interests.map((i) => (
              <li key={i}>
                <Badge accent="creative">{i}</Badge>
              </li>
            ))}
          </ul>
        </Reveal>
      </Section>

      <Section labelledBy="approach-heading" className="border-t border-line">
        <Reveal>
          <SectionHeading
            eyebrow="How I work"
            accent="business"
            title={<span id="approach-heading">Technology and business, together.</span>}
          />
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              t: "Build to learn",
              b: "I learn by making projects, such as a local-first AI workbench and a coaching platform, and by being open about what is finished and what is not.",
            },
            {
              t: "Test with intent",
              b: "I am studying software testing, test-case design and bug reporting, and I apply that thinking to my own projects.",
            },
            {
              t: "Communicate clearly",
              b: "Work in sales and operations taught me to follow up, coordinate with teams and keep clients informed.",
            },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 0.08}>
              <div className="surface h-full rounded-3xl p-6">
                <h3 className="font-display text-2xl text-fg">{c.t}</h3>
                <p className="mt-3 leading-relaxed text-fg-muted">{c.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <RelatedLinks links={[{ href: "/skills", label: "Skills", hint: "QA and software testing, web development and business skills." },{ href: "/projects", label: "Projects", hint: "Case studies: GenIQ, BHIM Coaching Center and this portfolio." },{ href: "/experience", label: "Experience", hint: "Sales, marketing and operations experience at Red Hills Group." }]} />
      <ContactCta />
    </>
  );
}
