"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { FileText } from "lucide-react";
import { saveResumeAction, uploadMediaAction } from "@/app/admin/(protected)/_actions/features";
import { StatusLine, SubmitButton, control, useToastAction } from "./forms";
import { StatusBadge, buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

export type PdfItem = { id: string; filename: string; size: number; createdAt: string };

export function ResumeManager({ pdfs, currentId, fallbackAvailable, canWrite }: { pdfs: PdfItem[]; currentId: string | null; fallbackAvailable: boolean; canWrite: boolean }) {
  const router = useRouter();
  const { toast } = useAdminUi();
  const [pending, start] = useTransition();
  const [state, action, uploading] = useToastAction(uploadMediaAction);
  const ref = useRef<HTMLFormElement>(null);

  const choose = (id: string | null) =>
    start(async () => {
      try {
        const res = await saveResumeAction(id);
        toast(res.ok ? "success" : "error", res.message);
        router.refresh();
      } catch {
        toast("error", "That action failed. Please try again.");
      }
    });

  return (
    <div className="space-y-8">
      <section className="surface rounded-3xl p-6" aria-labelledby="current-resume">
        <h2 id="current-resume" className="font-display text-2xl">Current resume</h2>
        {currentId ? (
          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge tone="published">managed here</StatusBadge>
            <a className="underline hover:text-tech" href={`/media/${currentId}`} target="_blank" rel="noopener noreferrer">View the current PDF</a>
            {canWrite && (
              <button type="button" disabled={pending} className={buttonStyles.ghost} onClick={() => choose(null)}>
                Stop using it
              </button>
            )}
          </p>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">
            {fallbackAvailable ? "No PDF chosen here: the built-in file from the website's /public folder is offered for download." : "No resume PDF is available. The Resume page shows a notice and the download button is hidden until you add one."}
          </p>
        )}
      </section>

      {canWrite && (
        <section className="surface space-y-4 rounded-3xl p-6" aria-labelledby="upload-resume">
          <h2 id="upload-resume" className="font-display text-2xl">Upload a new PDF</h2>
          <form
            ref={ref}
            action={async (fd) => {
              await action(fd);
              ref.current?.reset();
            }}
            className="space-y-3"
            aria-busy={uploading}
          >
            <label htmlFor="resume-file" className="block text-sm font-medium">PDF file (up to 3 MB)</label>
            <input id="resume-file" name="files" type="file" accept="application/pdf" required className={control} />
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton pending={uploading}>Upload</SubmitButton>
              <StatusLine state={state} />
            </div>
          </form>
        </section>
      )}

      <section className="surface rounded-3xl p-6" aria-labelledby="choose-resume">
        <h2 id="choose-resume" className="font-display text-2xl">Choose the file visitors download</h2>
        {pdfs.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">No PDFs uploaded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {pdfs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText aria-hidden className="h-4 w-4 shrink-0 text-fg-muted" />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{p.filename}</p>
                  <p className="text-xs text-fg-subtle">{Math.max(1, Math.round(p.size / 1024))} KB</p>
                </div>
                <a className="text-sm underline hover:text-tech" href={`/media/${p.id}`} target="_blank" rel="noopener noreferrer">Open</a>
                {p.id === currentId ? (
                  <StatusBadge tone="published">in use</StatusBadge>
                ) : (
                  canWrite && (
                    <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => choose(p.id)}>
                      Use this file
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
