import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/guard";
import { isAdminConfigured } from "@/lib/auth/env";
import { LoginForm } from "./LoginForm";

/** Redirects already-signed-in administrators; reads cookies, so it lives behind Suspense. */
async function LoginGate() {
  if (!isAdminConfigured()) {
    return (
      <p role="alert" className="rounded-2xl border border-line-strong p-4 text-sm text-fg-muted">
        The admin area is not configured on this deployment. Set <code className="font-mono text-fg">DATABASE_URL</code> and{" "}
        <code className="font-mono text-fg">AUTH_SECRET</code>, then create an administrator with{" "}
        <code className="font-mono text-fg">npm run admin:create</code>.
      </p>
    );
  }
  if (await getSession()) redirect("/admin");
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-16">
      <div className="surface w-full max-w-md rounded-3xl p-8 sm:p-10">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line-strong bg-tech/10 text-tech">
          <ShieldCheck aria-hidden className="h-5 w-5" />
        </span>
        <h1 className="mt-6 font-display text-4xl text-fg">Admin sign in</h1>
        <p className="mt-2 text-sm text-fg-muted">Private area. Authorised administrators only.</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-56" aria-hidden />}>
            <LoginGate />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
