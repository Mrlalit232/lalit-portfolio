"use server";

import { revalidatePath, updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import type { Permission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { rawValues, valuesToData, type FormValues } from "@/lib/content/codec";
import { entityByModule, type EntityDef } from "@/lib/content/registry";
import * as svc from "@/lib/content/service";

export type SaveState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string>; values?: FormValues };

export type OpResult = { ok: boolean; message: string };

export type ItemOp = "publish" | "unpublish" | "discard" | "archive" | "unarchive" | "delete" | "restore" | "purge" | "duplicate" | "up" | "down";

const OP_PERMISSION: Record<ItemOp, Permission> = {
  publish: "content:publish",
  unpublish: "content:publish",
  discard: "content:write",
  archive: "content:write",
  unarchive: "content:write",
  delete: "content:delete",
  restore: "content:delete",
  purge: "content:delete",
  duplicate: "content:write",
  up: "content:write",
  down: "content:write",
};

/** Every action authenticates and authorises itself; the module name is only trusted via the registry. */
async function context(module: string, permission: Permission) {
  const user = await requireAdmin(permission);
  const def = entityByModule(module);
  if (!def) notFound();
  return { user, def, db: await getDb() };
}

/** Makes the change visible: public pages (tagged cache) and the admin views. */
function refresh(def: EntityDef) {
  updateTag(`content:${def.type}`);
  revalidatePath("/admin", "layout");
}

/**
 * Create or update from the edit form. intent = "save" (draft) | "publish" (save, then go live).
 * `id` is "new", "singleton" (profile) or an item UUID.
 */
export async function saveContentAction(module: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const intent = formData.get("intent") === "publish" ? "publish" : "save";
  const { user, def, db } = await context(module, intent === "publish" ? "content:publish" : "content:write");
  const values = rawValues(def.fields, formData);
  const data = valuesToData(def.fields, values);

  const saved = def.singleton
    ? await svc.saveSingleton(db, def, user.id, data)
    : id === "new"
      ? await svc.createItem(db, def, user.id, data)
      : await svc.saveDraft(db, def, id, user.id, data);
  if (!saved.ok) return { status: "error", message: saved.error ?? "Fix the highlighted fields.", fieldErrors: saved.fieldErrors, values };

  let message = saved.message;
  if (intent === "publish") {
    const pub = await svc.publish(db, def, saved.item.id, user.id);
    if (!pub.ok) {
      refresh(def);
      return { status: "error", message: `Saved as a draft, but not published: ${pub.error ?? "fix the highlighted fields."}`, fieldErrors: pub.fieldErrors, values };
    }
    message = pub.message;
  }
  refresh(def);
  if (id === "new") redirect(`/admin/${def.module}/${saved.item.id}?notice=${intent === "publish" ? "published" : "created"}`);
  return { status: "ok", message };
}

/** Row and header actions (publish, unpublish, delete, ...). Called directly from client handlers. */
export async function itemOpAction(module: string, id: string, op: ItemOp): Promise<OpResult> {
  if (!(op in OP_PERMISSION)) return { ok: false, message: "Unknown action." };
  const { user, def, db } = await context(module, OP_PERMISSION[op]);
  const run = {
    publish: () => svc.publish(db, def, id, user.id),
    unpublish: () => svc.unpublish(db, def, id, user.id),
    discard: () => svc.discardDraft(db, def, id, user.id),
    archive: () => svc.setArchived(db, def, id, user.id, true),
    unarchive: () => svc.setArchived(db, def, id, user.id, false),
    delete: () => svc.softDelete(db, def, id, user.id),
    restore: () => svc.restore(db, def, id, user.id),
    purge: () => svc.purge(db, def, id, user.id),
    duplicate: () => svc.duplicate(db, def, id, user.id),
    up: () => svc.move(db, def, id, user.id, "up"),
    down: () => svc.move(db, def, id, user.id, "down"),
  }[op];
  const res = await run();
  refresh(def);
  if (!res.ok) {
    const detail = res.error ?? Object.values(res.fieldErrors ?? {})[0] ?? "Something went wrong.";
    return { ok: false, message: detail };
  }
  return { ok: true, message: res.message };
}
