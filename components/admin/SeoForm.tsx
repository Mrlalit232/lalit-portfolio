"use client";

import { saveSeoAction } from "@/app/admin/(protected)/_actions/features";
import { SEO_PAGES } from "@/lib/seo-pages";
import type { SeoSettings } from "@/lib/settings";
import { Field, StatusLine, SubmitButton, TextField, control, useToastAction } from "./forms";

export type ImageOption = { id: string; filename: string };

function ImageSelect({ name, value, images, label }: { name: string; value?: string; images: ImageOption[]; label: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <select id={name} name={name} defaultValue={value ?? ""} className={control}>
        <option value="">Default brand card</option>
        {images.map((i) => (
          <option key={i.id} value={i.id}>
            {i.filename}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SeoForm({ settings, images, canWrite }: { settings: SeoSettings; images: ImageOption[]; canWrite: boolean }) {
  const [state, action, pending] = useToastAction(saveSeoAction);
  return (
    <form action={action} className="space-y-8" aria-busy={pending}>
      <fieldset disabled={!canWrite} className="space-y-8">
        <section className="surface space-y-4 rounded-3xl p-6">
          <h2 className="font-display text-2xl">Site defaults</h2>
          <TextField label="Fallback description" name="defaultDescription" defaultValue={settings.defaultDescription} maxLength={200} help="Used only for a page that has no description of its own. Aim for 120-160 characters." />
          <ImageSelect name="defaultOgImage" value={settings.defaultOgImage} images={images} label="Default social sharing image" />
        </section>

        {SEO_PAGES.map((p) => {
          const o = settings.pages[p.path] ?? {};
          return (
            <section key={p.path} aria-labelledby={`seo-${p.path}`} className="surface space-y-4 rounded-3xl p-6">
              <h2 id={`seo-${p.path}`} className="font-display text-2xl">
                {p.label} <span className="font-mono text-sm text-fg-subtle">{p.path}</span>
              </h2>
              <p className="text-xs text-fg-subtle">Leave a field empty to keep the built-in text for this page.</p>
              <TextField label="Page title" name={`title:${p.path}`} defaultValue={o.title} maxLength={70} help="Up to 70 characters; the site name is added automatically (except on the home page)." />
              <Field label="Meta description" htmlFor={`description:${p.path}`} help="Up to 200 characters; search engines show about 160.">
                <textarea id={`description:${p.path}`} name={`description:${p.path}`} defaultValue={o.description} rows={2} maxLength={200} className={control} />
              </Field>
              <ImageSelect name={`ogImage:${p.path}`} value={o.ogImage} images={images} label="Social sharing image" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`noindex:${p.path}`} defaultChecked={Boolean(o.noindex)} className="h-4 w-4" />
                Ask search engines not to index this page (also removes it from the sitemap)
              </label>
            </section>
          );
        })}
      </fieldset>
      {canWrite && (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-ink-950/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          <SubmitButton pending={pending}>Save SEO settings</SubmitButton>
          <StatusLine state={state} />
        </div>
      )}
    </form>
  );
}
