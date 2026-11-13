"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { requireAdmin, getSession } from "@/lib/auth/guard";
import { getAuthSecret } from "@/lib/auth/env";
import type { Permission } from "@/lib/auth/permissions";
import { changeOwnPassword } from "@/lib/auth/users";
import { beginSetup, confirmSetup, disableTwoFactor, regenerateRecoveryCodes } from "@/lib/auth/twofactor";
import { BULK_OPS, bulkOperate, type BulkOp } from "@/lib/content/bulk";
import { createPreviewLink, revokePreviewLinks } from "@/lib/content/preview";
import { entityByModule } from "@/lib/content/registry";
import * as svc from "@/lib/content/service";
import { deleteMedia, saveUpload, updateAlt, MEDIA_MAX_BYTES } from "@/lib/media";
import { MESSAGE_STATUSES, deleteMessage, saveMessageNotes, setMessageStatus, type MessageStatus } from "@/lib/messages";
import { createRedirect, deleteRedirect, listRedirects, updateRedirect } from "@/lib/redirects";
import { SEO_PAGES, SETTING_KEYS, resumeSettingsSchema, saveSeoSettings, writeSetting } from "@/lib/settings";
import { getResumeSettings } from "@/lib/settings";

export type FormState =
  | { status: "idle" }
  | { status: "ok"; message: string; codes?: string[]; secret?: string; uri?: string }
  | { status: "error"; message: string };

const ok = (message: string, extra: Partial<Extract<FormState, { status: "ok" }>> = {}): FormState => ({ status: "ok", message, ...extra });
const err = (message: string): FormState => ({ status: "error", message });
export type SimpleResult = { ok: true; message: string; url?: string } | { ok: false; message: string };

const refreshAdmin = () => revalidatePath("/admin", "layout");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function ctx(module: string, permission: Permission) {
  const user = await requireAdmin(permission);
  const def = entityByModule(module);
  if (!def) return null;
  return { user, def, db: await getDb() };
}

/* ------------------------------------------------------------------ content tools */
const BULK_PERMISSION: Record<BulkOp, Permission> = {
  publish: "content:publish",
  unpublish: "content:publish",
  archive: "content:write",
  unarchive: "content:write",
  delete: "content:delete",
  restore: "content:delete",
  purge: "content:delete",
};

export async function bulkAction(module: string, ids: string[], op: BulkOp): Promise<SimpleResult> {
  if (!BULK_OPS.includes(op) || !Array.isArray(ids)) return { ok: false, message: "Unknown action." };
  const c = await ctx(module, BULK_PERMISSION[op]);
  if (!c || c.def.singleton) return { ok: false, message: "Unknown module." };
  const res = await bulkOperate(c.db, c.def, ids.filter((i) => typeof i === "string"), op, c.user.id);
  updateTag(`content:${c.def.type}`);
  refreshAdmin();
  const failed = res.failed.length ? ` ${res.failed.length} could not be changed (${res.failed[0].message})` : "";
  return { ok: res.done > 0 || res.failed.length === 0, message: `${res.done} item(s) updated.${failed}` };
}

export async function createPreviewAction(module: string, id: string, hours: number): Promise<SimpleResult> {
  const c = await ctx(module, "content:write");
  if (!c) return { ok: false, message: "Unknown module." };
  const res = await createPreviewLink(c.db, id, c.user.id, Number(hours) || 24);
  if (!res.ok) return { ok: false, message: res.error };
  return { ok: true, message: `Preview link created (valid until ${res.expiresAt.toUTCString()}).`, url: `/preview/${res.token}` };
}

export async function revokePreviewAction(module: string, id: string): Promise<SimpleResult> {
  const c = await ctx(module, "content:write");
  if (!c) return { ok: false, message: "Unknown module." };
  const n = await revokePreviewLinks(c.db, id, c.user.id);
  refreshAdmin();
  return { ok: true, message: n ? `Revoked ${n} preview link(s).` : "There were no active preview links." };
}

export async function schedulePublishAction(module: string, id: string, whenIso: string | null): Promise<SimpleResult> {
  const c = await ctx(module, "content:publish");
  if (!c) return { ok: false, message: "Unknown module." };
  const when = whenIso === null ? null : new Date(whenIso);
  const res = await svc.schedulePublish(c.db, c.def, id, c.user.id, when);
  refreshAdmin();
  if (!res.ok) return { ok: false, message: res.error ?? Object.values(res.fieldErrors ?? {})[0] ?? "Could not schedule." };
  return { ok: true, message: res.message };
}

export async function restoreRevisionAction(module: string, id: string, revisionId: string): Promise<SimpleResult> {
  const c = await ctx(module, "content:write");
  if (!c) return { ok: false, message: "Unknown module." };
  const res = await svc.restoreRevision(c.db, c.def, id, revisionId, c.user.id);
  updateTag(`content:${c.def.type}`);
  refreshAdmin();
  if (!res.ok) return { ok: false, message: res.error ?? Object.values(res.fieldErrors ?? {})[0] ?? "Could not restore." };
  return { ok: true, message: res.message };
}

/* ------------------------------------------------------------------ media */
export async function uploadMediaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("media:write");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return err("Choose at least one file.");
  if (files.length > 4) return err("Upload at most 4 files at a time.");
  const alt = str(formData, "alt");
  const db = await getDb();
  const done: string[] = [];
  const problems: string[] = [];
  for (const f of files) {
    if (f.size > MEDIA_MAX_BYTES) {
      problems.push(`${f.name}: larger than ${MEDIA_MAX_BYTES / 1024 / 1024} MB`);
      continue;
    }
    const res = await saveUpload(db, user.id, { filename: f.name, bytes: new Uint8Array(await f.arrayBuffer()), alt });
    if (res.ok) done.push(res.row.filename);
    else problems.push(`${f.name}: ${res.error}`);
  }
  refreshAdmin();
  if (done.length === 0) return err(problems.join(" "));
  return ok(`Uploaded ${done.length} file(s).${problems.length ? ` Skipped: ${problems.join("; ")}` : ""}`);
}

export async function updateMediaAltAction(id: string, alt: string): Promise<SimpleResult> {
  const user = await requireAdmin("media:write");
  const done = await updateAlt(await getDb(), user.id, id, alt);
  refreshAdmin();
  return done ? { ok: true, message: "Description saved." } : { ok: false, message: "File not found." };
}

export async function deleteMediaAction(id: string): Promise<SimpleResult> {
  const user = await requireAdmin("media:write");
  const res = await deleteMedia(await getDb(), user.id, id);
  refreshAdmin();
  return res.ok ? { ok: true, message: "File deleted." } : { ok: false, message: res.error };
}

/* ------------------------------------------------------------------ settings: SEO and resume */
export async function saveSeoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("settings:write");
  const pages: Record<string, Record<string, unknown>> = {};
  for (const p of SEO_PAGES) {
    const title = str(formData, `title:${p.path}`);
    const description = str(formData, `description:${p.path}`);
    const ogImage = str(formData, `ogImage:${p.path}`);
    pages[p.path] = {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(ogImage ? { ogImage } : {}),
      ...(formData.get(`noindex:${p.path}`) === "on" ? { noindex: true } : {}),
    };
  }
  const res = await saveSeoSettings(await getDb(), user.id, {
    defaultDescription: str(formData, "defaultDescription") || undefined,
    defaultOgImage: str(formData, "defaultOgImage") || undefined,
    pages,
  });
  if (!res.ok) return err(res.error);
  updateTag("settings");
  refreshAdmin();
  return ok("SEO settings saved. Changes appear on the public site within a minute.");
}

export async function saveResumeAction(mediaId: string | null): Promise<SimpleResult> {
  const user = await requireAdmin("settings:write");
  const db = await getDb();
  if (mediaId) {
    const parsed = resumeSettingsSchema.safeParse({ mediaId });
    if (!parsed.success) return { ok: false, message: "Invalid file." };
    const { getMediaFile } = await import("@/lib/media");
    const file = await getMediaFile(db, mediaId);
    if (!file || file.mime !== "application/pdf") return { ok: false, message: "Choose an uploaded PDF." };
  }
  await writeSetting(db, SETTING_KEYS.resume, mediaId ? { mediaId } : {}, user.id, mediaId ? "Set the resume PDF" : "Removed the managed resume PDF");
  updateTag("settings");
  refreshAdmin();
  return { ok: true, message: mediaId ? "Resume updated. The download buttons now use this file." : "Managed resume removed. The built-in file (if any) is used again." };
}

export async function currentResumeId() {
  await requireAdmin("content:read");
  return (await getResumeSettings(await getDb())).mediaId ?? null;
}

/* ------------------------------------------------------------------ redirects */
export async function saveRedirectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("settings:write");
  const db = await getDb();
  const id = str(formData, "id");
  const input = { fromPath: str(formData, "fromPath"), toPath: str(formData, "toPath"), status: Number(str(formData, "status")) || 301, enabled: formData.get("enabled") === "on" };
  const res = id ? await updateRedirect(db, user.id, id, input) : await createRedirect(db, user.id, input);
  refreshAdmin();
  return res.ok ? ok(id ? "Redirect updated." : "Redirect added. It takes effect within a few seconds.") : err(res.error);
}

export async function toggleRedirectAction(id: string, enabled: boolean): Promise<SimpleResult> {
  const user = await requireAdmin("settings:write");
  const db = await getDb();
  const row = (await listRedirects(db)).find((r) => r.id === id);
  if (!row) return { ok: false, message: "Redirect not found." };
  const res = await updateRedirect(db, user.id, id, { fromPath: row.fromPath, toPath: row.toPath, status: row.status, enabled });
  refreshAdmin();
  return res.ok ? { ok: true, message: enabled ? "Redirect enabled." : "Redirect disabled." } : { ok: false, message: res.error };
}

export async function deleteRedirectAction(id: string): Promise<SimpleResult> {
  const user = await requireAdmin("settings:write");
  const done = await deleteRedirect(await getDb(), user.id, id);
  refreshAdmin();
  return done ? { ok: true, message: "Redirect deleted." } : { ok: false, message: "Redirect not found." };
}

/* ------------------------------------------------------------------ contact inbox */
export async function setMessageStatusAction(id: string, status: MessageStatus): Promise<SimpleResult> {
  const user = await requireAdmin("messages:manage");
  if (!MESSAGE_STATUSES.includes(status)) return { ok: false, message: "Unknown status." };
  const done = await setMessageStatus(await getDb(), user.id, id, status);
  refreshAdmin();
  return done ? { ok: true, message: `Marked as ${status}.` } : { ok: false, message: "Message not found." };
}

export async function saveMessageNotesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("messages:manage");
  const done = await saveMessageNotes(await getDb(), user.id, str(formData, "id"), str(formData, "notes"));
  refreshAdmin();
  return done ? ok("Notes saved.") : err("Message not found.");
}

export async function deleteMessageAction(id: string): Promise<SimpleResult> {
  const user = await requireAdmin("messages:manage");
  const done = await deleteMessage(await getDb(), user.id, id);
  refreshAdmin();
  return done ? { ok: true, message: "Message deleted permanently." } : { ok: false, message: "Message not found." };
}

/* ------------------------------------------------------------------ account security */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return err("Your session has expired. Sign in again.");
  const next = str(formData, "newPassword");
  if (next !== str(formData, "confirmPassword")) return err("The new passwords do not match.");
  const res = await changeOwnPassword(await getDb(), session.user.id, str(formData, "currentPassword"), next, session.sessionId);
  return res.ok ? ok("Password changed. Your other sessions were signed out.") : err(res.error);
}

export async function beginTotpAction(): Promise<FormState> {
  const user = await requireAdmin("content:read");
  const res = await beginSetup(await getDb(), user.id, getAuthSecret());
  refreshAdmin();
  return res.ok ? ok("Add this key to your authenticator app, then enter a code below.", { secret: res.secret, uri: res.uri }) : err(res.error);
}

export async function confirmTotpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("content:read");
  const res = await confirmSetup(await getDb(), user.id, str(formData, "code"), getAuthSecret());
  refreshAdmin();
  return res.ok ? ok("Two-factor authentication is on. Save these recovery codes now: they are shown only once.", { codes: res.recoveryCodes }) : err(res.error);
}

export async function disableTotpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("content:read");
  const res = await disableTwoFactor(await getDb(), user.id, str(formData, "password"), str(formData, "code"), getAuthSecret());
  refreshAdmin();
  return res.ok ? ok("Two-factor authentication is off.") : err(res.error);
}

export async function regenerateCodesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin("content:read");
  const res = await regenerateRecoveryCodes(await getDb(), user.id, str(formData, "password"), str(formData, "code"), getAuthSecret());
  refreshAdmin();
  return res.ok ? ok("New recovery codes created. The old ones no longer work. They are shown only once.", { codes: res.recoveryCodes }) : err(res.error);
}
