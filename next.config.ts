import type { NextConfig } from "next";

/**
 * Security headers (spec §11).
 *
 * The CSP starts strict and is loosened only when a real need appears, each
 * with a comment saying why. `'unsafe-inline'` for styles is required by
 * Next.js, which injects inline <style> tags; scripts do NOT get it.
 */
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' is needed by the dev-mode React refresh runtime only.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // data: covers the inline QR code images generated in Phase 5.
  // blob: and https: cover ticket-type images uploaded to Supabase Storage.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase over https/wss. Tightened to the project's own host in Phase 2.
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Camera stays allowed on our OWN origin, and only ours.
    //
    // We do not build the QR scanner — the payment developer does (spec §1) —
    // but their /admin/check-in page will run on this domain, so this header
    // governs it. Setting `camera=()` here would make their scanner fail with
    // no useful error, and nobody would find out until the door on the night.
    // Documented for them in CHECK_IN_INTEGRATION.md.
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
