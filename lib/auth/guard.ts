import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "./constants";
import { can, type Permission } from "./permissions";
import { validateSession } from "./sessions";

/** Resolves the signed-in user from the session cookie. Memoised per request. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(await getDb(), token);
});

/**
 * The real access check. Call it at the top of every admin page, Server Action and route handler.
 * The proxy only does an optimistic cookie-presence redirect and is never trusted on its own.
 */
export async function requireAdmin(permission: Permission = "content:read") {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!can(session.user.role, permission)) notFound();
  return session.user;
}
