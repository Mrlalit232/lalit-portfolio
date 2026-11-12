"use server";

import { headers } from "next/headers";
import { contactSchema, inquiryTypes, type ContactInput, type ContactState } from "@/lib/contact";

/**
 * Spam protection, in layers:
 *  1. Honeypot field that real users never see or fill.
 *  2. Minimum fill time: bots submit instantly.
 *  3. Per-IP rate limit (in-memory, so best-effort on serverless).
 *  4. Strict server-side Zod validation.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const MIN_FILL_MS = 3000;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const values = {
    type: String(formData.get("type") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    company: String(formData.get("company") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  // Honeypot: pretend success so bots learn nothing, but do nothing.
  if (String(formData.get("website") ?? "").length > 0) {
    return { status: "success", message: "Thanks, your message has been received." };
  }

  const startedAt = Number(formData.get("startedAt"));
  if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < MIN_FILL_MS) {
    return { status: "error", message: "That was submitted too quickly. Please review your message and try again.", values };
  }

  const parsed = contactSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    email: formData.get("email"),
    company: String(formData.get("company") ?? "") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactInput;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) {
    return { status: "error", message: "Too many messages from this connection. Please try again in a few minutes.", values };
  }

  const data = parsed.data;
  const typeLabel = inquiryTypes.find((t) => t.value === data.type)?.label ?? data.type;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    // Nothing is sent, so never report success.
    const publicEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    const mailto = publicEmail
      ? `mailto:${publicEmail}?subject=${encodeURIComponent(`${typeLabel} from ${data.name}`)}&body=${encodeURIComponent(data.message)}`
      : undefined;
    return {
      status: "unconfigured",
      message:
        "Email delivery is not configured on this site yet, so your message was not sent." +
        (mailto ? " You can send it with the email link below." : ""),
      mailto,
      values,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: data.email,
        subject: `[Portfolio] ${typeLabel} from ${data.name}`,
        html: `<p><strong>Type:</strong> ${escapeHtml(typeLabel)}</p>
<p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
${data.company ? `<p><strong>Company:</strong> ${escapeHtml(data.company)}</p>` : ""}
<p><strong>Message:</strong></p><p>${escapeHtml(data.message).replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!res.ok) {
      return { status: "error", message: "The message could not be delivered. Please try again, or use the email link on this page.", values };
    }
    return { status: "success", message: "Thanks, your message has been sent. I will reply by email." };
  } catch {
    return { status: "error", message: "A network error occurred. Please try again shortly.", values };
  }
}
