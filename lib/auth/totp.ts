import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238, HMAC-SHA1, 6 digits, 30 s) implemented with Node's built-in crypto: no extra dependency.
 * Compatible with Google Authenticator, Microsoft Authenticator, 1Password, Authy, etc.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;

export function base32Encode(buf: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateSecret = () => base32Encode(randomBytes(20)); // 160 bits

function hotp(key: Buffer, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

export const totpAt = (secretB32: string, atMs: number) => hotp(base32Decode(secretB32), Math.floor(atMs / 1000 / TOTP_STEP_SECONDS));

/**
 * Returns the matched time step, or null. Accepts the previous, current and next step (clock drift) but only a
 * step strictly greater than `lastStep`, so a captured code cannot be replayed.
 */
export function verifyTotp(secretB32: string, code: string, now = Date.now(), lastStep: number | null = null): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secretB32);
  const current = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(hotp(key, step));
    const given = Buffer.from(clean);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return step;
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer = "Portfolio Admin") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/* ---- secret encryption at rest (AES-256-GCM, key derived from AUTH_SECRET) ---- */
const key = (authSecret: string) => Buffer.from(hkdfSync("sha256", authSecret, "portfolio-totp", "totp-secret-v1", 32));

export function encryptSecret(secretB32: string, authSecret: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(authSecret), iv);
  const ct = Buffer.concat([c.update(secretB32, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, authSecret: string) {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Bad secret format");
  try {
    const d = createDecipheriv("aes-256-gcm", key(authSecret), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Almost always: AUTH_SECRET was changed after two-factor authentication was set up (see docs/security.md).
    throw new Error(SECRET_UNREADABLE);
  }
}

/** Shown in server logs so the operator knows what to do (never includes any secret). */
export const SECRET_UNREADABLE =
  "The stored two-factor secret cannot be decrypted with the current AUTH_SECRET (it was probably changed or is wrong). Run `npm run admin:reset-2fa` for the affected account, then set up two-factor again.";

/* ---- recovery codes ---- */
const RC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCode() {
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (b) => RC_ALPHABET[b % RC_ALPHABET.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export const normalizeRecoveryCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const hashRecoveryCode = (authSecret: string, code: string) =>
  createHmac("sha256", authSecret).update(`recovery:${normalizeRecoveryCode(code)}`).digest("hex");

/* ---- short-lived "password verified, 2FA pending" challenge (signed, stateless) ---- */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function signChallenge(authSecret: string, userId: string, now = Date.now()) {
  const body = `${userId}.${now + CHALLENGE_TTL_MS}`;
  const sig = createHmac("sha256", authSecret).update(`2fa:${body}`).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyChallenge(authSecret: string, token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = createHmac("sha256", authSecret).update(`2fa:${userId}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return null;
  return /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}
