/** Secret used to key IP/account hashes and (later) sign preview tokens. Server-side only. */
export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters. Run `npm run setup:local` for local development.");
  }
  return secret;
}

/** Admin needs a hosted database in production; the embedded database is for local development only. */
export function isAdminConfigured() {
  if (process.env.NODE_ENV !== "production") return true;
  const hasDb = Boolean(process.env.DATABASE_URL) || process.env.ALLOW_LOCAL_DB === "1";
  return hasDb && Boolean(process.env.AUTH_SECRET);
}
