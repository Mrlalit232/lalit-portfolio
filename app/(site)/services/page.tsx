import { buildMetadata } from "@/lib/seo";
import { serviceProcess, services } from "@/data/services";
import { ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { ContactCta, ServiceGrid } from "@/components/sections/shared";

export const metadata = buildMetadata({
  title: "Services",
  description:
    "Website development, business websites, portfolio sites, landing pages, maintenance and digital marketing support from Lalit Kumar Saini.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        accent="business"
        title={
          <>
            Websites and digital support for <em className="text-gradient">small teams</em>.
          </>
        }
        description="I build and maintain websites and support digital marketing operations. I am early in my career, and I aim to be clear about scope, communication and what I can deliver."
      >
        <ButtonLink href="/contact?type=project">Start a project enquiry</ButtonLink>
      </PageHero>

      <Section labelledBy="services-heading">
        <h2 id="services-heading" className="sr-only">
          Services
        </h2>
        <ServiceGrid items={services} />
      </Section>

      <Section labelledBy="process-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="How a project runs"
            title={<span id="process-heading">A simple, transparent process.</span>}
          />
        </Reveal>
        <Stagger className="mt-12 grid gap-5 md:grid-cols-4">
          {serviceProcess.map((s) => (
            <StaggerItem key={s.step} className="h-full">
              <div className="surface h-full rounded-3xl p-6">
                <p className="font-mono text-sm text-tech">{s.step}</p>
                <h3 className="mt-3 font-display text-2xl text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-8 max-w-2xl text-sm text-fg-subtle">
          Scope and timelines are agreed per project after a conversation. No pricing, guarantees or client results are
          advertised here.
        </p>
      </Section>

      <ContactCta
        title="Tell me about your project."
        body="Share what you need and I will reply with questions or next steps."
      />
    </>
  );
}
