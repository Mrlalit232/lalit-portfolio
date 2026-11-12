import { hash, verify } from "@node-rs/argon2";
import { MIN_PASSWORD_LENGTH } from "./constants";

// argon2id (the library default) with OWASP-recommended minimum parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(hashed: string, password: string) {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/** Verifies against a throwaway hash so unknown accounts cost the same time as known ones. */
export async function verifyAgainstDummy(password: string) {
  dummy ??= hashPassword("dummy-password-for-timing-equalisation");
  await verifyPassword(await dummy, password);
}

/** Returns an error message, or null when acceptable. */
export function checkPasswordStrength(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 128) return "Use at most 128 characters.";
  if (/^(.)\1+$/.test(password)) return "Password cannot be a single repeated character.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Password must not contain your email name.";
  }
  return null;
}
