import type { Metadata } from "next";

/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately hand-written rather than pulling in `clsx` + `tailwind-merge`:
 * the spec says avoid unnecessary dependencies, and our components put their
 * own classes first and spread caller classes last, which covers the override
 * cases we actually have.
 *
 *   cn("px-4", isActive && "bg-accent", className)
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Metadata that keeps a page out of search engines.
 *
 * Applied in Phase 5 to /tickets/[accessToken] (a page reachable by anyone
 * holding the link) and in Phase 7 to every /admin route. See spec §7 and §11.
 */
export function noindexMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false, nocache: true },
  };
}

/**
 * True when dev-only routes (/design now, /dev/mock-payment in Phase 5) are
 * allowed to render. They must 404 in production — spec §8.
 */
export function devRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
