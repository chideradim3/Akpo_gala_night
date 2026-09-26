import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignShowcase } from "@/app/design/DesignShowcase";
import { devRoutesEnabled, noindexMetadata } from "@/lib/utils";

/**
 * In production this route 404s, so it must not announce itself in the page
 * title either — a dev-only route should look like it does not exist.
 */
export const metadata: Metadata = devRoutesEnabled()
  ? noindexMetadata("Design system")
  : { robots: { index: false, follow: false } };

/**
 * Dev-only gallery of every UI primitive in every state.
 *
 * This is how Phase 1 gets reviewed: there is no data in the app yet, so the
 * design system needs somewhere it can actually be looked at.
 *
 * It 404s in production — the same guard `/dev/mock-payment` will use in
 * Phase 5, proven here first.
 */
export default function DesignPage() {
  if (!devRoutesEnabled()) {
    notFound();
  }
  return <DesignShowcase />;
}
