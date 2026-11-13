import "server-only";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getPublicSeo } from "./public";

type Base = Parameters<typeof buildMetadata>[0];

/** buildMetadata + the owner's SEO-manager overrides for this page (title, description, social image, noindex). */
export async function pageMetadata(base: Base): Promise<Metadata> {
  const seo = await getPublicSeo();
  const o = seo.pages[base.path];
  const image = o?.ogImage ?? seo.defaultOgImage;
  return buildMetadata({
    ...base,
    title: o?.title ?? base.title,
    description: o?.description ?? base.description ?? seo.defaultDescription ?? "",
    noindex: o?.noindex ? true : base.noindex,
    image: image ? `/media/${image}` : base.image,
  });
}
