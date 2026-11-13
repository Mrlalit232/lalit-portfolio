import type { Db } from "@/db/client";
import type { EntityDef } from "./registry";
import * as svc from "./service";

export const BULK_OPS = ["publish", "unpublish", "archive", "unarchive", "delete", "restore", "purge"] as const;
export type BulkOp = (typeof BULK_OPS)[number];
export const BULK_MAX = 100;

export type BulkResult = { done: number; failed: { id: string; message: string }[] };

/** Runs one operation over many items. One failure never stops the rest; each is reported. */
export async function bulkOperate(db: Db, def: EntityDef, ids: string[], op: BulkOp, actorId: string): Promise<BulkResult> {
  const unique = [...new Set(ids)].slice(0, BULK_MAX);
  const out: BulkResult = { done: 0, failed: [] };
  for (const id of unique) {
    const res =
      op === "publish" ? await svc.publish(db, def, id, actorId)
      : op === "unpublish" ? await svc.unpublish(db, def, id, actorId)
      : op === "archive" ? await svc.setArchived(db, def, id, actorId, true)
      : op === "unarchive" ? await svc.setArchived(db, def, id, actorId, false)
      : op === "delete" ? await svc.softDelete(db, def, id, actorId)
      : op === "restore" ? await svc.restore(db, def, id, actorId)
      : await svc.purge(db, def, id, actorId);
    if (res.ok) out.done++;
    else out.failed.push({ id, message: res.error ?? Object.values(res.fieldErrors ?? {})[0] ?? "Failed." });
  }
  return out;
}
