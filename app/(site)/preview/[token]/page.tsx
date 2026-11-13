import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import type { Project, Venture } from "@/data/types";
import { getDb } from "@/lib/db";
import { resolvePreview } from "@/lib/content/preview";
import { workingCopy } from "@/lib/content/service";
import { CaseStudy } from "@/components/projects/CaseStudy";
import { VentureDetail } from "@/components/sections/VentureCard";
import { Container, Section } from "@/components/ui/primitives";

// A preview must never be indexed, cached or shared by a search engine.
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * Renders the WORKING COPY (draft) of an item through the same components the public site uses, so it can be
 * reviewed before publishing. Access needs an unguessable, expiring, revocable token created in the admin.
 */
// Private page: never prerendered. (proxy.ts validates the token first, so an invalid link is a real HTTP 404.)
export const instant = false;

export default async function PreviewPage({ params }: PageProps<"/preview/[token]">) {
  await connection();
  const { token } = await params;
  let resolved;
  try {
    resolved = await resolvePreview(await getDb(), token);
  } catch {
    notFound();
  }
  if (!resolved) notFound();
  const { item, def } = resolved;

  const parsed = def.schema.safeParse(workingCopy(item));
  const banner = (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[70] border-t border-business/40 bg-ink-950/95 px-4 py-3 text-center text-sm text-fg backdrop-blur">
      <strong className="font-medium">Preview.</strong> This is an unpublished draft{item.status === "published" ? " of a published item" : ""}. It is not visible to the public.
    </div>
  );

  if (!parsed.success) {
    return (
      <>
        <Section>
          <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm">
            This draft has validation errors and cannot be previewed yet: {parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join("; ")}
          </p>
        </Section>
        {banner}
      </>
    );
  }

  return (
    <>
      {def.type === "project" && <CaseStudy project={parsed.data as unknown as Project} />}
      {def.type === "venture" && (
        <Section>
          <Container>
            <VentureDetail venture={parsed.data as unknown as Venture} />
          </Container>
        </Section>
      )}
      {banner}
    </>
  );
}
