"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Sends one anonymous page-view ping per route change (see app/api/analytics/route.ts). No cookies or identifiers.
 * Skipped when the browser asks not to be tracked; the server applies the same rule and also ignores bots.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (!navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "text/plain" }))) {
        void fetch("/api/analytics", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {
      // analytics must never affect the page
    }
  }, [pathname]);
  return null;
}
