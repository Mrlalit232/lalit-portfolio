import Link from "next/link";
import { ArrowRight, Cpu, Download, Handshake, Sparkles } from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { resumePdfAvailable } from "@/lib/resume";
import { services } from "@/data/services";
import { getCredentials, getExperience, getProfile, getProjects, getSkillGroups, getTestimonials, getVentures } from "@/lib/content/public";
import { ButtonLink, Container, Section, SectionHeading, accentDot, cn } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { VentureCard } from "@/components/sections/VentureCard";
import {
  ContactCta,
  CredentialGrid,
  ExperienceCard,
  TestimonialGrid,
  ServiceGrid,
  SkillGroups,
} from "@/components/sections/shared";

export const metadata = buildMetadata({
  title: "Lalit Kumar Saini — Technology × Business × Creativity",
  absoluteTitle: true,
  description:
    "Lalit Kumar Saini: BCA student with web development projects, a QA and test automation focus, and hands-on client, sales and operations experience.",
  path: "/",
});

const pillars = [
  {
    icon: Cpu,
    label: "Technology",
    text: "Web development, software testing and automation.",
    color: "text-tech",
    ring: "from-tech/30",
  },
  {
    icon: Handshake,
    label: "Business",
    text: "Clients, leads, follow-ups and operations.",
    color: "text-business",
    ring: "from-business/30",
  },
  {
    icon: Sparkles,
    label: "Creativity",
    text: "Digital marketing and thoughtful design.",
    color: "text-creative",
    ring: "from-creative/30",
  },
];

export default async function HomePage() {
  const pdfReady = resumePdfAvailable();
  const [profile, projects, experience, skillGroups, credentials, ventures, testimonials] = await Promise.all([
    getProfile(),
    getProjects(),
    getExperience(),
    getSkillGroups(),
    getCredentials(),
    getVentures(),
    getTestimonials(),
  ]);
  const featuredProjects = projects.filter((p) => p.featured);
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-44">
        <div aria-hidden className="aurora absolute inset-0 -z-10" />
        <div aria-hidden className="grid-bg absolute inset-0 -z-10" />
        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-xs text-fg-muted">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-tech" />
                BCA student · Web · QA · Operations
              </p>
              <h1 className="mt-6 font-display text-6xl leading-[0.95] tracking-tight text-fg sm:text-7xl lg:text-8xl">
                {profile.name}
              </h1>
              <p className="mt-5 font-display text-3xl italic leading-tight sm:text-4xl">
                <span className="text-gradient">{profile.headline}</span>
              </p>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">{profile.intro}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/projects">
                  View Projects
                  <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </ButtonLink>
                <ButtonLink href="/contact" variant="secondary">
                  Contact Me
                </ButtonLink>
                {pdfReady ? (
                  <ButtonLink href={site.resumePdf} variant="ghost" download>
                    <Download aria-hidden className="h-4 w-4" />
                    Download Resume
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/resume" variant="ghost">
                    View Resume
                  </ButtonLink>
                )}
              </div>
            </div>

            <Reveal delay={0.15}>
              <ul className="space-y-3" aria-label="Three strengths">
                {pillars.map((p) => (
                  <li
                    key={p.label}
                    className="surface relative overflow-hidden rounded-3xl p-5"
                  >
                    <div
                      aria-hidden
                      className={cn("absolute -left-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl", p.ring)}
                    />
                    <div className="relative flex items-center gap-4">
                      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line-strong bg-ink-900", p.color)}>
                        <p.icon aria-hidden className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-display text-2xl text-fg">{p.label}</p>
                        <p className="text-sm text-fg-muted">{p.text}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* A. Introduction */}
      <Section labelledBy="intro-heading" className="border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <SectionHeading
              eyebrow="Introduction"
              title={<span id="intro-heading">Technical learning, backed by real client work.</span>}
            />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="space-y-5 text-lg leading-relaxed text-fg-muted">
              <p>{profile.about.paragraphs[0]}</p>
              <p>{profile.about.paragraphs[1]}</p>
              <Link href="/about" className="inline-flex items-center gap-2 text-fg underline-offset-4 hover:text-tech hover:underline">
                More about me <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* B. Focus areas */}
      <Section labelledBy="focus-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="Professional focus"
            accent="business"
            title={<span id="focus-heading">Five areas I work in.</span>}
            description="Technical and business skills sit side by side, so I can build, check and communicate."
          />
        </Reveal>
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.focusAreas.map((f) => (
            <StaggerItem key={f.id} className="h-full">
              <div className="surface surface-hover h-full rounded-3xl p-6">
                <span aria-hidden className={cn("block h-1.5 w-8 rounded-full", accentDot[f.accent])} />
                <h3 className="mt-5 font-display text-2xl text-fg">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* C. Featured projects */}
      <Section labelledBy="projects-heading" className="border-t border-line">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionHeading
              eyebrow="Featured projects"
              title={<span id="projects-heading">Work I have built.</span>}
              description="Each project has a case study that separates what is built from what is planned."
            />
          </Reveal>
          <ButtonLink href="/projects" variant="secondary">
            All projects
          </ButtonLink>
        </div>
        <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featuredProjects.map((p, i) => (
            <StaggerItem key={p.slug} className="h-full">
              <ProjectCard project={p} index={i} />
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* D. Experience */}
      <Section labelledBy="exp-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="Professional experience"
            accent="business"
            title={<span id="exp-heading">Hands-on business experience.</span>}
          />
        </Reveal>
        <Reveal delay={0.1} className="mt-12">
          {experience.map((e) => (
            <ExperienceCard key={e.company} item={e} />
          ))}
        </Reveal>
        <div className="mt-6">
          <ButtonLink href="/experience" variant="ghost">
            Full experience <ArrowRight aria-hidden className="h-4 w-4" />
          </ButtonLink>
        </div>
      </Section>

      {/* E. Skills */}
      <Section labelledBy="skills-heading" className="border-t border-line">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionHeading
              eyebrow="Technical skills"
              title={<span id="skills-heading">Skills across four areas.</span>}
            />
          </Reveal>
          <ButtonLink href="/skills" variant="secondary">
            Skills in detail
          </ButtonLink>
        </div>
        <div className="mt-12">
          <SkillGroups groups={skillGroups} compact />
        </div>
      </Section>

      {/* F. Services preview */}
      <Section labelledBy="services-heading" className="border-t border-line bg-ink-900/40">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionHeading
              eyebrow="Services"
              accent="business"
              title={<span id="services-heading">Websites and digital support.</span>}
              description="For businesses and individuals who need a clear, working web presence."
            />
          </Reveal>
          <ButtonLink href="/services" variant="secondary">
            Explore services
          </ButtonLink>
        </div>
        <div className="mt-12">
          <ServiceGrid items={services.slice(0, 3)} preview />
        </div>
      </Section>

      {/* Ventures preview */}
      <Section labelledBy="ventures-heading" className="border-t border-line">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionHeading
              eyebrow="Entrepreneurship & Ventures"
              accent="business"
              title={<span id="ventures-heading">Building toward businesses.</span>}
              description="One early-stage initiative in progress and two concepts, each labelled with its real status."
            />
          </Reveal>
          <ButtonLink href="/ventures" variant="secondary">
            All ventures
          </ButtonLink>
        </div>
        <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {ventures.map((v) => (
            <StaggerItem key={v.id} className="h-full">
              <VentureCard venture={v} />
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* G. Certifications */}
      <Section labelledBy="cred-heading" className="border-t border-line bg-ink-900/40">
        <Reveal>
          <SectionHeading
            eyebrow="Certifications & achievements"
            accent="creative"
            title={<span id="cred-heading">Education, learning and participation.</span>}
            description="Listed as they are: certifications, participation and activities, with no awards claimed."
          />
        </Reveal>
        <div className="mt-12">
          <CredentialGrid items={credentials} />
        </div>
      </Section>

      {/* Testimonials: only genuine, published ones; hidden entirely when there are none */}
      {testimonials.length > 0 && (
        <Section labelledBy="testimonials-heading" className="border-t border-line">
          <Reveal>
            <SectionHeading eyebrow="Testimonials" accent="creative" title={<span id="testimonials-heading">What people say.</span>} />
          </Reveal>
          <div className="mt-12">
            <TestimonialGrid items={testimonials} />
          </div>
        </Section>
      )}

      {/* H. Contact CTA */}
      <ContactCta />
    </>
  );
}
