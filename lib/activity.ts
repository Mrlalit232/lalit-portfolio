import type { Db } from "@/db/client";
import { activityLog } from "@/db/schema";

/** Writes an audit entry. `meta` must never contain secrets or raw credentials. */
export async function logActivity(
  db: Db,
  entry: {
    actorId?: string | null;
    action: string;
    summary: string;
    entityType?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  },
) {
  await db.insert(activityLog).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    summary: entry.summary,
    entityType: entry.entityType,
    entityId: entry.entityId,
    meta: entry.meta,
  });
}
