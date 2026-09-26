import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { Container, EmptyState } from "@/components/ui";
import { getEventWithTiers } from "@/lib/services/events";

export const metadata: Metadata = {
  title: "Buy tickets",
  // Checkout has nothing worth indexing and should never be a search result
  // someone lands on ahead of the event page.
  robots: { index: false, follow: true },
};

// Availability is read here and shown as "Sold out" / "N left", so the page
// must not be served from a stale cache.
export const dynamic = "force-dynamic";

/**
 * The checkout route.
 *
 * A server component: it reads the event and its tiers — including live
 * availability — and hands them to the client flow. No database access
 * happens in the browser.
 */
export default async function CheckoutPage() {
  const data = await getEventWithTiers();

  if (!data) {
    return (
      <main id="main" className="flex flex-1 items-center py-24">
        <Container width="narrow">
          <EmptyState
            title="Tickets are not on sale"
            description="There is no event open for booking at the moment. Please check back soon."
          />
        </Container>
      </main>
    );
  }

  return (
    <main id="main" className="flex-1">
      <Container width="narrow" className="pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
        >
          <span aria-hidden>&larr;</span> Back to the event
        </Link>
      </Container>

      <CheckoutFlow tiers={data.tiers} />
    </main>
  );
}
