import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/guard";
import { isAdminConfigured, getAuthSecret } from "@/lib/auth/env";
import { readChallengeCookie } from "@/lib/auth/cookie";
import { verifyChallenge } from "@/lib/auth/totp";
import { VerifyForm } from "./VerifyForm";

async function VerifyGate() {
  await connection();
  if (!isAdminConfigured()) redirect("/admin/login");
  if (await getSession()) redirect("/admin");
  // Without a valid, unexpired password-step marker there is nothing to verify: start over.
  if (!verifyChallenge(getAuthSecret(), await readChallengeCookie())) redirect("/admin/login");
  return <VerifyForm />;
}

export default function VerifyPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-16">
      <div className="surface w-full max-w-md rounded-3xl p-8 sm:p-10">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line-strong bg-tech/10 text-tech">
          <ShieldCheck aria-hidden className="h-5 w-5" />
        </span>
        <h1 className="mt-6 font-display text-4xl text-fg">Two-factor check</h1>
        <p className="mt-2 text-sm text-fg-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-40" aria-hidden />}>
            <VerifyGate />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
