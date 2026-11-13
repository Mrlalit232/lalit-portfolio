import { jsonLdString } from "@/lib/seo";

/** Renders one JSON-LD block. Data must be built from verified content only. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
