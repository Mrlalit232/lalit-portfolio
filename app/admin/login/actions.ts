"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookie";
import { getAuthSecret } from "@/lib/auth/env";
import { attemptLogin } from "@/lib/auth/login";
import { getSession } from "@/lib/auth/guard";
import { revokeSession } from "@/lib/auth/sessions";

export type LoginState = { error?: string };

const schema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and your password." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  let result;
  try {
    result = await attemptLogin(await getDb(), {
      ...parsed.data,
      ip,
      userAgent: h.get("user-agent") ?? undefined,
      secret: getAuthSecret(),
    });
  } catch (error) {
    console.error("Login unavailable:", error instanceof Error ? error.message : error);
    return { error: "Sign-in is temporarily unavailable. Please try again shortly." };
  }

  if (!result.ok) {
    if (result.reason === "locked") {
      const minutes = Math.ceil(result.retryAfterSec / 60);
      return { error: `Too many failed attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` };
    }
    return { error: "Incorrect email or password." }; // identical for unknown account and wrong password
  }

  await setSessionCookie(result.token, result.expiresAt);
  redirect("/admin");
}

export async function logoutAction() {
  const session = await getSession();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = await getDb();
  if (token) await revokeSession(db, token);
  if (session) await logActivity(db, { actorId: session.user.id, action: "auth.logout", summary: "Signed out" });
  await clearSessionCookie();
  redirect("/admin/login");
}
