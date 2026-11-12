import { requireAdmin } from "@/lib/auth/guard";
import { logoutAction } from "../login/actions";

// Milestone 2 placeholder: proves authentication end to end. The real dashboard arrives in Milestone 3.
export default async function AdminHome() {
  const user = await requireAdmin();
  return (
    <main className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="font-display text-4xl">Signed in</h1>
      <p className="mt-3 text-fg-muted">
        Authenticated as <span className="text-fg">{user.email}</span> ({user.role}).
      </p>
      <p className="mt-2 text-sm text-fg-subtle">The dashboard and content modules are built in the next milestones.</p>
      <form action={logoutAction} className="mt-8">
        <button type="submit" className="rounded-full border border-line-strong px-5 py-2.5 text-sm hover:bg-white/[0.06]">
          Sign out
        </button>
      </form>
    </main>
  );
}
