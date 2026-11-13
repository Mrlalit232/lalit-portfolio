import { getSession } from "@/lib/auth/guard";
import { requireAdmin } from "@/lib/auth/guard";
import { getAuthSecret } from "@/lib/auth/env";
import { isTwoFactorEnabled, pendingSetup, unusedRecoveryCodeCount } from "@/lib/auth/twofactor";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ChangePasswordForm, TwoFactorPanel } from "@/components/admin/SecurityPanels";

// Private, session-gated page that is never prerendered; Next's instant-navigation validation (which flags every
// session/params/searchParams read) does not apply. Blocking on the server is the intended behaviour here.
export const instant = false;

export default async function SecurityPage() {
  await requireAdmin("content:read");
  const session = (await getSession())!;
  const db = await getDb();
  const enabled = isTwoFactorEnabled(session.user);
  const [pending, left] = await Promise.all([
    enabled ? null : pendingSetup(db, session.user.id, getAuthSecret()).catch(() => null),
    enabled ? unusedRecoveryCodeCount(db, session.user.id) : 0,
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Account security" description={`Signed in as ${session.user.email} (${session.user.role}).`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="pw-heading" className="surface min-w-0 rounded-3xl p-6">
          <h2 id="pw-heading" className="font-display text-2xl">Password</h2>
          <div className="mt-5">
            <ChangePasswordForm />
          </div>
        </section>
        <section aria-labelledby="2fa-heading" className="surface min-w-0 rounded-3xl p-6">
          <h2 id="2fa-heading" className="font-display text-2xl">Two-factor authentication</h2>
          <div className="mt-5">
            <TwoFactorPanel enabled={enabled} recoveryLeft={left} pending={pending} />
          </div>
          <p className="mt-6 text-xs text-fg-subtle">
            Lost your phone and your recovery codes? Reset it from a trusted computer with database access:{" "}
            <code className="font-mono text-fg">npm run admin:reset-2fa</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
