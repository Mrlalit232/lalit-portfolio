import { buildMetadata } from "@/lib/seo";
import { getVentures } from "@/lib/content/public";
import { PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { ContactCta, RelatedLinks } from "@/components/sections/shared";
import { VentureDetail } from "@/components/sections/VentureCard";

export const metadata = buildMetadata({
  title: "Entrepreneurship & Ventures",
  description:
    "Entrepreneurial initiatives by Lalit Kumar Saini: an early-stage website development business, plus two concepts: a business solutions platform and a business collaboration ecosystem.",
  path: "/ventures",
});

export default async function VenturesPage() {
  const ventures = await getVentures();
  const active = ventures.filter((v) => v.stage === "active");
  const concepts = ventures.filter((v) => v.stage === "concept");

  return (
    <>
      <PageHero
        crumb={{ name: "Ventures", path: "/ventures" }}
        eyebrow="Entrepreneurship & Ventures"
        accent="business"
        title={
          <>
            Building toward <em className="text-gradient">businesses</em>, step by step.
          </>
        }
        description="One initiative is early-stage work in progress. The others are concepts I am planning and exploring. Each is labelled with its real status."
      />

      <Section labelledBy="active-heading">
        <Reveal>
          <SectionHeading
            eyebrow="In progress"
            title={<span id="active-heading">Active work.</span>}
            description="Early-stage, and ongoing."
          />
        </Reveal>
        <div className="mt-10 space-y-6">
          {active.map((v) => (
            <Reveal key={v.id}>
              <VentureDetail venture={v} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section labelledBy="concept-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="Concepts"
            accent="creative"
            title={<span id="concept-heading">Ideas in planning.</span>}
            description="These are proposals and explorations, not operating businesses."
          />
        </Reveal>
        <div className="mt-10 space-y-6">
          {concepts.map((v) => (
            <Reveal key={v.id}>
              <VentureDetail venture={v} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section labelledBy="honesty-heading" className="border-t border-line">
        <Reveal>
          <SectionHeading
            eyebrow="To be clear"
            accent="business"
            title={<span id="honesty-heading">What I am not claiming.</span>}
            description="None of these ventures has been publicly launched, and I make no claims of revenue or customers. The status labels above describe where each one actually is."
          />
        </Reveal>
      </Section>

      <RelatedLinks links={[{ href: "/services", label: "Services", hint: "Website development services available today." },{ href: "/projects", label: "Projects", hint: "Project work that supports these initiatives." },{ href: "/about", label: "About", hint: "Background and direction." }]} />
      <ContactCta
        title="Interested in collaborating?"
        body="If you are a business owner, potential partner or service provider and want to talk, I would like to hear from you."
      />
    </>
  );
}
