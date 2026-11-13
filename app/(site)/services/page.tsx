import { pageMetadata } from "@/lib/content/page-seo";
import { serviceProcess } from "@/data/services";
import { getServices } from "@/lib/content/public";
import { ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { ContactCta, ServiceGrid, RelatedLinks } from "@/components/sections/shared";

export async function generateMetadata() {
  return pageMetadata({
  title: "Services",
  description:
    "Website development, business websites, portfolio sites, landing pages, maintenance and digital marketing support from Lalit Kumar Saini.",
  path: "/services",
  });
}

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageHero
        crumb={{ name: "Services", path: "/services" }}
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

      <RelatedLinks links={[{ href: "/projects", label: "Projects", hint: "Examples of websites and web apps I have built." },{ href: "/skills", label: "Skills", hint: "The technologies and practices behind the work." },{ href: "/ventures", label: "Ventures", hint: "The website development business and related ideas." }]} />
      <ContactCta
        title="Tell me about your project."
        body="Share what you need and I will reply with questions or next steps."
      />
    </>
  );
}
