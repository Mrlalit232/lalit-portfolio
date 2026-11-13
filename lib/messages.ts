import { and, count, desc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contactMessages } from "@/db/schema";
import { logActivity } from "@/lib/activity";

export const MESSAGE_STATUSES = ["new", "read", "archived", "spam"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Called by the public contact form after validation and spam checks. */
export async function storeMessage(db: Db, input: { type: string; name: string; email: string; company?: string; message: string }) {
  const [row] = await db
    .insert(contactMessages)
    .values({ type: input.type, name: input.name, email: input.email, company: input.company || null, message: input.message })
    .returning();
  return row;
}

export async function markEmailed(db: Db, id: string) {
  await db.update(contactMessages).set({ emailed: true }).where(eq(contactMessages.id, id));
}

export async function listMessages(db: Db, status: MessageStatus | "all" = "all") {
  const where = status === "all" ? ne(contactMessages.status, "spam") : eq(contactMessages.status, status);
  return db.select().from(contactMessages).where(where).orderBy(desc(contactMessages.createdAt)).limit(500);
}

export async function getMessage(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
  return row ?? null;
}

export async function setMessageStatus(db: Db, actorId: string, id: string, status: MessageStatus) {
  if (!MESSAGE_STATUSES.includes(status)) return false;
  const [row] = await db
    .update(contactMessages)
    .set({ status, handledAt: status === "new" ? null : new Date() })
    .where(eq(contactMessages.id, id))
    .returning({ id: contactMessages.id });
  if (row) await logActivity(db, { actorId, action: "message.status", entityType: "message", entityId: id, summary: `Marked a contact message as ${status}` });
  return Boolean(row);
}

export async function saveMessageNotes(db: Db, actorId: string, id: string, notes: string) {
  const [row] = await db.update(contactMessages).set({ notes: notes.slice(0, 2000) }).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
  if (row) await logActivity(db, { actorId, action: "message.notes", entityType: "message", entityId: id, summary: "Updated notes on a contact message" });
  return Boolean(row);
}

export async function deleteMessage(db: Db, actorId: string, id: string) {
  const [row] = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
  if (row) await logActivity(db, { actorId, action: "message.delete", entityType: "message", entityId: id, summary: "Permanently deleted a contact message" });
  return Boolean(row);
}

export async function unreadCount(db: Db) {
  const [row] = await db.select({ n: count() }).from(contactMessages).where(and(eq(contactMessages.status, "new")));
  return Number(row?.n ?? 0);
}
