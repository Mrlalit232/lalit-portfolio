import { Suspense, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { personJsonLd, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/ui/JsonLd";

/** Public-site chrome: skip link, structured data, header, main landmark, footer. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="no-print sr-only z-[60] rounded-full bg-fg px-4 py-2 text-sm font-medium text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <JsonLd data={personJsonLd} />
      <JsonLd data={websiteJsonLd} />
      {/* usePathname() is request-time on dynamic routes (e.g. /projects/[slug]); the placeholder keeps layout stable. */}
      <Suspense fallback={<div aria-hidden className="fixed inset-x-0 top-0 z-50 h-16" />}>
        <Header />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
