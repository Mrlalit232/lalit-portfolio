import { ButtonLink, Container } from "@/components/ui/primitives";
import { SiteShell } from "@/components/layout/SiteShell";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <SiteShell>
    <Container className="grid min-h-[70vh] place-items-center pt-24 text-center">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-tech">Error 404</p>
        <h1 className="mt-4 font-display text-5xl text-fg sm:text-6xl">This page doesn&apos;t exist.</h1>
        <p className="mx-auto mt-4 max-w-md text-fg-muted">
          The link may be broken or the page may have moved. Head back to the homepage or browse my projects.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Back home</ButtonLink>
          <ButtonLink href="/projects" variant="secondary">
            View projects
          </ButtonLink>
        </div>
      </div>
    </Container>
    </SiteShell>
  );
}
