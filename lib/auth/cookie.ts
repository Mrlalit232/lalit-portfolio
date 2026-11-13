import "server-only";
import { cookies } from "next/headers";
import { CHALLENGE_COOKIE, SESSION_COOKIE } from "./constants";
import { CHALLENGE_TTL_MS } from "./totp";

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/", // required for the __Host- prefix
    expires,
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function setChallengeCookie(value: string) {
  (await cookies()).set(CHALLENGE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
  });
}

export async function readChallengeCookie() {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value;
}

export async function clearChallengeCookie() {
  (await cookies()).set(CHALLENGE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}
