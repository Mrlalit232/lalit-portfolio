import type { User } from "@/db/schema";

export type Role = User["role"];

/** Extend this list as modules are added. Call sites only ever use `can()`. */
export type Permission =
  | "content:read"
  | "content:write"
  | "content:publish"
  | "content:delete"
  | "media:write"
  | "settings:write"
  | "messages:manage"
  | "users:manage";

const ALL: Permission[] = [
  "content:read",
  "content:write",
  "content:publish",
  "content:delete",
  "media:write",
  "settings:write",
  "messages:manage",
  "users:manage",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  // Prepared for future multi-user support; no editor accounts are created in release 1.
  editor: ["content:read", "content:write", "media:write", "messages:manage"],
};

export function can(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
