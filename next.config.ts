import type { NextConfig } from "next";
import { buildCsp } from "./lib/csp";

const siteIsHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const contentSecurityPolicy = buildCsp({
  dev: process.env.NODE_ENV === "development",
  upgradeInsecure: process.env.NODE_ENV === "production" && siteIsHttps,
});

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Media uploads (up to 4 files x 3 MB) travel through a Server Action.
    serverActions: { bodySizeLimit: "14mb" },
  },
  // Optional override so a second server (e.g. automated testing) can run beside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  partialPrefetching: true,
  // Embedded Postgres (local development only) loads its own WASM files at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // Browsers ignore HSTS over plain HTTP, so this only takes effect once the site is served over HTTPS.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
      {
        // Content-Security-Policy everywhere except /media: uploaded files set their own, stricter `sandbox` policy in the
        // route handler, and a config header would override it.
        source: "/((?!media/).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
      {
        // Draft previews: never cached or indexed, and the URL (which contains the token) must not leak via Referer.
        source: "/preview/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Private area: never cached, never indexed, never framed.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
