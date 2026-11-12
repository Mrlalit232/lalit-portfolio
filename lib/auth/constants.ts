const prod = process.env.NODE_ENV === "production";

/** `__Host-` prefix (Secure, Path=/, no Domain) in production; plain name on http://localhost dev. */
export const SESSION_COOKIE = prod ? "__Host-session" : "session";

export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000; // sliding idle timeout
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // hard cap
export const SESSION_TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILS_PER_ACCOUNT = 5;
export const LOGIN_MAX_FAILS_PER_IP = 20;

export const MIN_PASSWORD_LENGTH = 12;
