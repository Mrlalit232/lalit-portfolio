"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, Copy, FileText, Trash2 } from "lucide-react";
import { deleteMediaAction, updateMediaAltAction, uploadMediaAction } from "@/app/admin/(protected)/_actions/features";
import { StatusLine, SubmitButton, control, useToastAction } from "./forms";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

export type MediaItem = { id: string; filename: string; mime: string; size: number; alt: string; createdAt: string };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Card({ item, canWrite }: { item: MediaItem; canWrite: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [pending, start] = useTransition();
  const [alt, setAlt] = useState(item.alt);
  const [copied, setCopied] = useState(false);
  const isImage = item.mime.startsWith("image/");
  const url = `/media/${item.id}`;

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      try {
        const res = await fn();
        toast(res.ok ? "success" : "error", res.message);
        router.refresh();
      } catch {
        toast("error", "That action failed. Please try again.");
      }
    });

  return (
    <li className="surface flex min-w-0 flex-col overflow-hidden rounded-2xl">
      <div className="grid h-40 place-items-center bg-ink-900">
        {isImage ? (
          <Image src={url} alt={item.alt || item.filename} width={320} height={160} unoptimized className="h-40 w-full object-contain" />
        ) : (
          <FileText aria-hidden className="h-10 w-10 text-fg-muted" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={item.filename}>{item.filename}</p>
          <p className="text-xs text-fg-subtle">{item.mime} · {kb(item.size)}</p>
          <p className="mt-1 break-all font-mono text-xs text-fg-muted">{url}</p>
        </div>
        {canWrite && isImage && (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`alt-${item.id}`}>Description (alt text) for {item.filename}</label>
            <input id={`alt-${item.id}`} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image" maxLength={200} className={control} />
            <button type="button" disabled={pending || alt === item.alt} className={buttonStyles.secondary} onClick={() => run(() => updateMediaAltAction(item.id, alt))}>
              Save
            </button>
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast("error", `Copy this path manually: ${url}`);
              }
            }}
          >
            {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />} {copied ? "Copied" : "Copy path"}
          </button>
          {canWrite && (
            <button
              type="button"
              disabled={pending}
              className={buttonStyles.danger}
              onClick={async () => {
                if (await confirm({ title: "Delete this file?", body: "This cannot be undone. A file that is still used by content or settings cannot be deleted.", confirmLabel: "Delete", danger: true })) run(() => deleteMediaAction(item.id));
              }}
            >
              <Trash2 aria-hidden className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function MediaLibrary({ items, canWrite }: { items: MediaItem[]; canWrite: boolean }) {
  const [state, action, pending] = useToastAction(uploadMediaAction);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-8">
      {canWrite && (
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
          className="surface space-y-4 rounded-3xl p-6"
          aria-busy={pending}
        >
          <h2 className="font-display text-2xl">Upload</h2>
          <div>
            <label htmlFor="media-files" className="mb-1.5 block text-sm font-medium">Files</label>
            <input id="media-files" name="files" type="file" multiple required accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" className={control} />
            <p className="mt-1.5 text-xs text-fg-subtle">PNG, JPEG, GIF, WebP or PDF, up to 3 MB each. The real file type is checked on the server; SVG is not accepted.</p>
          </div>
          <div>
            <label htmlFor="media-alt" className="mb-1.5 block text-sm font-medium">Description for images (optional)</label>
            <input id="media-alt" name="alt" maxLength={200} className={control} placeholder="What the image shows" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pending={pending}>Upload</SubmitButton>
            <StatusLine state={state} />
          </div>
        </form>
      )}
      {items.length === 0 ? (
        <p className="surface rounded-3xl border-dashed p-10 text-center text-sm text-fg-muted">No files yet. Uploaded files appear here.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.id} item={m} canWrite={canWrite} />
          ))}
        </ul>
      )}
    </div>
  );
}
