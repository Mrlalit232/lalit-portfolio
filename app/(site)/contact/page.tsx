import type React from "react";
import { Suspense } from "react";
import { Briefcase, Handshake, Mail, Rocket } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/ui/icons";
import { pageMetadata } from "@/lib/content/page-seo";
import { getProfile } from "@/lib/content/public";
import { ContactForm } from "@/components/contact/ContactForm";
import { Container, PageHero } from "@/components/ui/primitives";

export async function generateMetadata() {
  return pageMetadata({
  title: "Contact",
  description:
    "Contact Lalit Kumar Saini about employment opportunities, website projects or business collaboration.",
  path: "/contact",
  });
}

const reasons = [
  { icon: Briefcase, title: "Employment", text: "Roles in web development, QA and testing, or business operations." },
  { icon: Rocket, title: "Website projects", text: "Business sites, portfolios, landing pages and maintenance." },
  { icon: Handshake, title: "Collaboration", text: "Partnerships, marketing support and shared projects." },
];

export default async function ContactPage() {
  const { contact } = await getProfile();
  const { email, linkedin, github, location } = contact;
  const direct = [
    email && { icon: Mail, label: "Email", value: email, href: `mailto:${email}` },
    linkedin && { icon: LinkedinIcon, label: "LinkedIn", value: "Connect on LinkedIn", href: linkedin },
    github && { icon: GithubIcon, label: "GitHub", value: "View my code", href: github },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string; value: string; href: string }[];

  return (
    <>
      <PageHero
        crumb={{ name: "Contact", path: "/contact" }}
        eyebrow="Contact"
        title={
          <>
            Let&apos;s <em className="text-gradient">talk</em>.
          </>
        }
        description="Choose the kind of enquiry that fits and I will reply by email."
      />

      <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-8">
          <ul className="space-y-3">
            {reasons.map((r) => (
              <li key={r.title} className="surface flex gap-4 rounded-2xl p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tech/10 text-tech">
                  <r.icon aria-hidden className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-medium text-fg">{r.title}</h2>
                  <p className="mt-1 text-sm text-fg-muted">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">Direct</h2>
            <p className="mt-4 text-sm text-fg-muted">Based in {location}</p>
            {direct.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {direct.map((d) => (
                  <li key={d.label}>
                    <a
                      href={d.href}
                      {...(d.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="group inline-flex items-center gap-3 text-fg-muted transition-colors hover:text-fg"
                    >
                      <d.icon aria-hidden className="h-4 w-4 text-tech" />
                      <span>
                        <span className="sr-only">{d.label}: </span>
                        {d.value}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-fg-muted">
                Direct email and social links will appear here once they are configured. Use the form in the meantime.
              </p>
            )}
          </div>
        </div>

        <div>
          <Suspense fallback={<div className="surface min-h-[28rem] rounded-3xl" aria-hidden />}>
            <ContactForm />
          </Suspense>
        </div>
      </Container>
    </>
  );
}
