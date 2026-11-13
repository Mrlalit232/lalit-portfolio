import Link from "next/link";
import { footerNav } from "@/data/navigation";
import { site } from "@/lib/site";
import { Container } from "@/components/ui/primitives";
import { GithubIcon, LinkedinIcon } from "@/components/ui/icons";
import { Mail } from "lucide-react";

export function Footer() {
  const { email, linkedin, github } = site.contact;
  const links = [
    email && { label: "Email", href: `mailto:${email}`, Icon: Mail },
    linkedin && { label: "LinkedIn", href: linkedin, Icon: LinkedinIcon },
    github && { label: "GitHub", href: github, Icon: GithubIcon },
  ].filter(Boolean) as { label: string; href: string; Icon: typeof Mail }[];

  return (
    <footer className="no-print border-t border-line bg-ink-900/60">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl text-fg">{site.name}</p>
            <p className="mt-2 text-sm text-fg-muted">
              <span className="text-tech">Technology</span> × <span className="text-business">Business</span> ×{" "}
              <span className="text-creative">Creativity</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-subtle">
              Web development, QA and test automation, client and business management, operations and digital marketing.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">Pages</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-fg-muted transition-colors hover:text-fg">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">Connect</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex items-center gap-2.5 text-fg-muted transition-colors hover:text-fg"
                  >
                    <l.Icon aria-hidden className="h-4 w-4" />
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/contact" className="text-fg-muted transition-colors hover:text-fg">
                  Contact form
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-line pt-6 text-xs text-fg-subtle">
          © {site.name}. Built with Next.js.
        </p>
      </Container>
    </footer>
  );
}
