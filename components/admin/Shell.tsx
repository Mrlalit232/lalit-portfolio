"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Activity,
  ArrowRightLeft,
  Award,
  BarChart3,
  Briefcase,
  ChevronRight,
  ConciergeBell,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  Moon,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import { cn } from "@/components/ui/primitives";
import { logoutAction } from "@/app/admin/login/actions";

type NavItem = { href: string; label: string; icon: typeof Mail };
const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Content",
    items: [
      { href: "/admin/profile", label: "Profile", icon: User },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
      { href: "/admin/skills", label: "Skills", icon: Sparkles },
      { href: "/admin/experience", label: "Experience", icon: Briefcase },
      { href: "/admin/education", label: "Education", icon: GraduationCap },
      { href: "/admin/certifications", label: "Certifications", icon: Award },
      { href: "/admin/services", label: "Services", icon: ConciergeBell },
      { href: "/admin/ventures", label: "Ventures", icon: Rocket },
      { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
    ],
  },
  {
    heading: "Site",
    items: [
      { href: "/admin/media", label: "Media library", icon: Images },
      { href: "/admin/resume", label: "Resume", icon: FileText },
      { href: "/admin/seo", label: "SEO", icon: Globe },
      { href: "/admin/redirects", label: "Redirects", icon: ArrowRightLeft },
    ],
  },
  {
    heading: "Inbox & insights",
    items: [
      { href: "/admin/messages", label: "Messages", icon: Mail },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/activity", label: "Activity", icon: Activity },
    ],
  },
  { heading: "Account", items: [{ href: "/admin/security", label: "Security", icon: ShieldCheck }] },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

const LABELS: Record<string, string> = Object.fromEntries([
  ...NAV.map((n) => [n.href.split("/")[2] ?? "", n.label] as const),
  ["new", "New"],
  ["search", "Search"],
]);

/* ---- theme (light/dark), stored in localStorage and applied by an inline script before paint ---- */
const subscribe = (cb: () => void) => {
  window.addEventListener("admin-theme", cb);
  return () => window.removeEventListener("admin-theme", cb);
};
const getTheme = () => document.documentElement.dataset.adminTheme === "light" ? "light" : "dark";

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.adminTheme = next;
        try {
          localStorage.setItem("admin-theme", next);
        } catch {}
        window.dispatchEvent(new Event("admin-theme"));
      }}
      aria-label={`Switch to ${next} theme`}
      className="grid h-9 w-9 place-items-center rounded-full border border-line-strong hover:bg-white/[0.06]"
    >
      {theme === "dark" ? <Sun aria-hidden className="h-4 w-4" /> : <Moon aria-hidden className="h-4 w-4" />}
    </button>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).slice(1); // drop "admin"
  const crumbs = [{ href: "/admin", label: "Dashboard" }];
  parts.forEach((p, i) => {
    const isId = /^[0-9a-f-]{36}$/i.test(p);
    crumbs.push({ href: `/admin/${parts.slice(0, i + 1).join("/")}`, label: isId ? "Edit" : (LABELS[p] ?? p) });
  });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm text-fg-muted">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-medium text-fg">
                {c.label}
              </span>
            ) : (
              <Link prefetch={false} href={c.href} className="hover:text-fg">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NavList({ onNavigate, unread = 0 }: { onNavigate?: () => void; unread?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.heading && <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">{group.heading}</p>}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                prefetch={false}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-white/[0.08] font-medium text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                <Icon aria-hidden className={cn("h-4 w-4", active && "text-tech")} />
                {label}
                {href === "/admin/messages" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-tech/20 px-2 py-0.5 font-mono text-[11px] text-tech" aria-label={`${unread} unread`}>
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ user, unread = 0, children }: { user: { email: string; role: string }; unread?: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const drawerOpen = open === pathname; // closes automatically on navigation
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="admin-scope min-h-screen bg-ink-950 text-fg">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-ink-900 p-4 lg:flex">
        <Link prefetch={false} href="/admin" className="mb-6 flex items-center gap-3 px-2">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl border border-line-strong font-display text-lg">L</span>
          <span className="text-sm font-medium">Portfolio CMS</span>
        </Link>
        <NavList unread={unread} />
        <Link prefetch={false} href="/" target="_blank" rel="noopener" className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg-muted hover:bg-white/[0.04] hover:text-fg">
          <ExternalLink aria-hidden className="h-4 w-4" /> View public site
        </Link>
      </aside>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(null)} />
          <div className="relative h-full w-72 max-w-[85%] overflow-y-auto border-r border-line bg-ink-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">Portfolio CMS</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.06]">
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(null)} unread={unread} />
            <Link prefetch={false} href="/" target="_blank" rel="noopener" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg-muted hover:text-fg">
              <ExternalLink aria-hidden className="h-4 w-4" /> View public site
            </Link>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-ink-950/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            ref={toggleRef}
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setOpen(pathname)}
            className="grid h-9 w-9 place-items-center rounded-full border border-line-strong lg:hidden"
          >
            <Menu aria-hidden className="h-4 w-4" />
          </button>
          <Breadcrumbs />
          <form action="/admin/search" role="search" className="ml-auto flex min-w-0 max-w-xs flex-1 items-center gap-2 rounded-full border border-line-strong px-3 focus-within:border-tech">
            <Search aria-hidden className="h-4 w-4 text-fg-subtle" />
            <label htmlFor="admin-search" className="sr-only">
              Search content
            </label>
            <input id="admin-search" name="q" type="search" placeholder="Search content…" className="h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-fg-subtle" />
          </form>
          <ThemeToggle />
          <details className="relative">
            <summary aria-label="Account menu" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-line-strong text-sm font-medium hover:bg-white/[0.06] [&::-webkit-details-marker]:hidden">
              {user.email[0]?.toUpperCase()}
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line-strong bg-ink-900 p-3 shadow-xl">
              <p className="truncate text-sm font-medium">{user.email}</p>
              <p className="text-xs capitalize text-fg-subtle">{user.role}</p>
              <form action={logoutAction} className="mt-3 border-t border-line pt-3">
                <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-fg-muted hover:bg-white/[0.06] hover:text-fg">
                  <LogOut aria-hidden className="h-4 w-4" /> Sign out
                </button>
              </form>
            </div>
          </details>
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
