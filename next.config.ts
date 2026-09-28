import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

/**
 * Every LAN address this machine answers on, e.g. ["172.20.10.5"].
 *
 * Next 16 refuses to serve dev resources — the JavaScript chunks included —
 * to an origin it does not recognise, and returns 403. Opening the dev
 * server on a phone at http://192.168.x.x:3000 therefore loads the HTML and
 * the CSS but no JavaScript, so nothing hydrates: forms submit as plain
 * HTML, client validation never runs, and buttons appear to do nothing.
 *
 * Detecting the addresses rather than hardcoding one means this keeps
 * working when the laptop moves between networks or the router hands out a
 * different address.
 */
function localNetworkOrigins(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

/**
 * Security headers (spec §11).
 *
 * The CSP starts strict and is loosened only when a real need appears, each
 * with a comment saying why. `'unsafe-inline'` for styles is required by
 * Next.js, which injects inline <style> tags; scripts do NOT get it.
 */
const isDev = process.env.NODE_ENV !== "production";

/**
 * The Supabase project's own origin, so the CSP can name it instead of
 * allowing every https host on the internet.
 *
 * `https:` as a blanket allowance largely defeats the point of a CSP: an
 * injected script could exfiltrate to anywhere. Naming one host means a
 * successful injection has nowhere to send what it steals.
 *
 * Falls back to the broad form if the variable is missing, because a site
 * that refuses to talk to its own database is worse than a loose header —
 * and `lib/env.ts` already complains loudly about the missing variable.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

/**
 * Cloudflare Turnstile needs its script and its iframe allowed.
 *
 * Added ONLY when a site key is configured, so a deployment without bot
 * protection does not carry a permission it never uses. The widget is
 * served from this origin and renders inside an iframe from it, so both
 * script-src and frame-src are required — miss either and the check
 * silently fails to appear, which with the server failing closed would
 * reject every order.
 */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
const turnstileSrc = turnstileEnabled ? ` ${TURNSTILE_ORIGIN}` : "";

const connectSrc = supabaseOrigin
  ? `'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}`
  : "'self' https: wss:";

const imgSrc = supabaseOrigin
  ? `'self' data: blob: ${supabaseOrigin}`
  : "'self' data: blob: https:";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' is needed by the dev-mode React refresh runtime only.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${turnstileSrc}`,
  "style-src 'self' 'unsafe-inline'",
  // data: for the inline QR codes, blob: for uploads in progress, and the
  // Supabase origin for images stored there. Not all of https.
  `img-src ${imgSrc}`,
  "font-src 'self' data:",
  // Supabase only — REST, auth and realtime. Narrowed from `https:` in the
  // Phase 9 review.
  `connect-src ${connectSrc}`,
  // PRODUCTION: nothing may frame this site — that is clickjacking
  // protection and it matters on the checkout above all.
  //
  // DEVELOPMENT: 'self' instead, so /dev/responsive can frame our own
  // pages to measure them at widths headless Chrome refuses to give.
  // Other origins are still refused either way.
  `frame-ancestors ${isDev ? "'self'" : "'none'"}`,
  // What THIS page may frame — distinct from frame-ancestors, which is who
  // may frame us. Only the Turnstile widget, and only when it is in use.
  `frame-src 'self'${turnstileSrc}`,
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",

  // PRODUCTION ONLY. This directive tells the browser to rewrite every
  // http:// subresource request to https://.
  //
  // In development that breaks the site the moment you open it on anything
  // other than localhost. Browsers treat localhost as a secure context and
  // leave it alone, but `http://192.168.x.x:3000` — how you view the site on
  // a real phone — is not, so the browser upgrades the CSS and JS requests to
  // https://192.168.x.x:3000, there is no TLS on the dev server, every
  // request fails, and the page renders as unstyled HTML.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // The older header that does the same job for browsers predating CSP.
  // Same reasoning as frame-ancestors above.
  { key: "X-Frame-Options", value: isDev ? "SAMEORIGIN" : "DENY" },
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

  // PRODUCTION ONLY, for the same reason as upgrade-insecure-requests.
  // A browser ignores HSTS over plain http, but if you ever do open the dev
  // server over https once, this header would pin the browser to https for
  // that host for two years — including `localhost`, which then breaks every
  // other project you run on it. Not worth the risk for zero dev benefit.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Development only, and only this machine's own LAN addresses — so testing
  // on a real phone works, without opening the dev server to anything else.
  // Has no effect on a production build.
  ...(isDev ? { allowedDevOrigins: localNetworkOrigins() } : {}),

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
