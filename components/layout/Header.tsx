"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { primaryNav, resumeNav } from "@/data/navigation";
import { cn } from "@/components/ui/primitives";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  // The menu is open only for the route it was opened on, so navigating closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = false) => {
    setOpenFor(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard support, focus trap and scroll lock while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(true);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = [
        buttonRef.current,
        ...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      ].filter(Boolean) as HTMLElement[];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <header
      className={cn(
        "no-print fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open ? "border-b border-line bg-ink-950/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-xl border border-line-strong bg-white/[0.04] font-display text-lg leading-none text-fg transition-colors group-hover:border-tech/60"
          >
            L
          </span>
          {/* Visible from sm up; always available to screen readers (the accessible name matches the visible text). */}
          <span className="sr-only text-sm font-medium tracking-tight text-fg sm:not-sr-only">Lalit Kumar Saini</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
          {primaryNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm transition-colors",
                  active ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="nav-pill absolute inset-0 -z-10 rounded-full border border-line-strong bg-white/[0.06]"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={resumeNav.href}
            className="hidden rounded-full bg-fg px-4 py-2 text-sm font-medium text-ink-950 transition-all hover:bg-white hover:shadow-[0_0_0_4px_rgb(108_199_255/0.18)] xl:inline-flex"
          >
            {resumeNav.label}
          </Link>
          <button
            ref={buttonRef}
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line-strong text-fg transition-colors hover:bg-white/[0.06] xl:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpenFor(open ? null : pathname)}
          >
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
          <div
            id={menuId}
            ref={panelRef}
            className="menu-in absolute inset-x-0 top-16 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-ink-950/95 backdrop-blur-xl xl:hidden"
          >
            <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 sm:px-6">
              {[...primaryNav, resumeNav].map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-2xl px-4 py-4 font-display text-3xl tracking-tight transition-colors",
                      active ? "bg-white/[0.06] text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
                    )}
                  >
                    {item.label}
                    {active && <span aria-hidden className="h-2 w-2 rounded-full bg-tech" />}
                  </Link>
                );
              })}
            </nav>
          </div>
      )}
    </header>
  );
}
