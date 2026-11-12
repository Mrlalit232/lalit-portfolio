import "server-only";
import { createDb, type DbHandle } from "@/db/client";

export { hasHostedDb } from "@/db/client";

const g = globalThis as unknown as { __db?: Promise<DbHandle> };

/** Lazily created singleton (survives dev hot reloads). Server-only: never import from client code. */
export async function getDb() {
  g.__db ??= createDb();
  return (await g.__db).db;
}
