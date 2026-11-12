import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/guard";
import { AdminShell } from "@/components/admin/Shell";
import { AdminUiProvider } from "@/components/admin/provider";

/**
 * Every page in this group sits behind a real server-side session check.
 * Content renders only after `requireAdmin()` resolves, so nothing leaks to signed-out visitors.
 */
async function Gate({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <AdminUiProvider>
      <AdminShell user={{ email: user.email, role: user.role }}>{children}</AdminShell>
    </AdminUiProvider>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-fg-muted">Loading…</div>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
