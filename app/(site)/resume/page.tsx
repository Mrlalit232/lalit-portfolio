import { Download } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { resumePdfAvailable } from "@/lib/resume";
import { getCredentials, getExperience, getProfile, getProjects, getSkillGroups } from "@/lib/content/public";
import { ButtonLink, Container } from "@/components/ui/primitives";
import { PrintButton } from "@/components/sections/PrintButton";

export const metadata = buildMetadata({
  title: "Resume",
  description:
    "Resume of Lalit Kumar Saini: education, experience, projects, skills and certifications. Download as PDF or print.",
  path: "/resume",
});

function RSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="border-b border-line pb-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-tech">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ResumePage() {
  const [profile, experience, projects, skillGroups, credentials] = await Promise.all([getProfile(), getExperience(), getProjects(), getSkillGroups(), getCredentials()]);
  // Checked at build time: the download button only appears when the real file exists.
  const pdfAvailable = resumePdfAvailable();
  const { email, linkedin, github, location } = profile.contact;
  const contactItems = [email, location, linkedin, github].filter(Boolean) as string[];

  return (
    <>
      <header className="no-print relative isolate overflow-hidden border-b border-line pb-12 pt-32 sm:pt-40">
        <div aria-hidden className="aurora absolute inset-0 -z-10" />
        <Container>
          <Breadcrumbs trail={[{ name: "Resume", path: "/resume" }]} />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-tech">Resume</p>
          <h1 className="mt-4 font-display text-5xl tracking-tight text-fg sm:text-6xl">Resume</h1>
          <p className="mt-4 max-w-xl text-fg-muted">
            A text-based, ATS-friendly resume. Use your browser&apos;s print dialog to save a PDF copy of this page.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {pdfAvailable ? (
              <ButtonLink href={site.resumePdf} download>
                <Download aria-hidden className="h-4 w-4" />
                Download PDF
              </ButtonLink>
            ) : (
              <p role="note" className="rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-fg-muted">
                The PDF is not published yet. Add it as <code className="font-mono text-fg">public{site.resumePdf}</code> and
                the download button will appear.
              </p>
            )}
            <PrintButton />
          </div>
        </Container>
      </header>

      <Container className="py-12 sm:py-16">
        <article
          aria-label="Resume of Lalit Kumar Saini"
          className="print-sheet surface mx-auto max-w-3xl rounded-3xl p-6 sm:p-12"
        >
          <header>
            <h2 className="font-display text-4xl text-fg">{profile.name}</h2>
            <p className="mt-1 text-fg-muted">
              Web Development · QA &amp; Test Automation · Client &amp; Business Management · Operations · Digital Marketing
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              {contactItems.length > 0 ? contactItems.join(" | ") : "Contact details: see the Contact page of this website."}
            </p>
          </header>

          <RSection title="Summary">
            <p className="leading-relaxed text-fg-muted">{profile.intro}</p>
          </RSection>

          <RSection title="Education">
            <p className="font-medium text-fg">Bachelor of Computer Applications (BCA)</p>
            <p className="text-fg-muted">St. Andrews Institute of Technology &amp; Management. Final-year / graduate level.</p>
          </RSection>

          <RSection title="Experience">
            {experience.map((e) => (
              <div key={e.company}>
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium text-fg">
                    {e.role}, {e.company}
                  </p>
                  <p className="text-sm text-fg-muted">{e.period}</p>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  {e.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </RSection>

          <RSection title="Projects">
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.slug}>
                  <p className="font-medium text-fg">
                    {p.title} <span className="font-normal text-fg-muted">({p.stack.join(", ")})</span>
                  </p>
                  <p className="text-fg-muted">{p.tagline}</p>
                </li>
              ))}
            </ul>
          </RSection>

          <RSection title="Skills">
            <ul className="space-y-1.5 text-fg-muted">
              {skillGroups.map((g) => (
                <li key={g.id}>
                  <span className="font-medium text-fg">{g.title}: </span>
                  {g.skills.map((s) => s.name).join(", ")}
                </li>
              ))}
            </ul>
          </RSection>

          <RSection title="Certifications & Activities">
            <ul className="list-disc space-y-1 pl-5 text-fg-muted">
              {credentials
                .filter((c) => c.kind !== "Education")
                .map((c) => (
                  <li key={c.title}>
                    {c.title}, {c.issuer}
                    {c.kind === "Participation" ? " (participation)" : ""}
                  </li>
                ))}
            </ul>
          </RSection>
        </article>
      </Container>
    </>
  );
}
