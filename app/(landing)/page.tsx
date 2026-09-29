import type { Metadata } from "next";

import { About } from "@/components/event/About";
import { Contact } from "@/components/event/Contact";
import { Faq } from "@/components/event/Faq";
import { Gallery } from "@/components/event/Gallery";
import { Hero } from "@/components/event/Hero";
import { Programme } from "@/components/event/Programme";
import { SectionRule } from "@/components/event/Section";
import { Sponsor } from "@/components/event/Sponsor";
import { SiteFooter } from "@/components/event/SiteFooter";
import { SiteHeader } from "@/components/event/SiteHeader";
import { TicketsPreview } from "@/components/event/TicketsPreview";
import { Container, EmptyState } from "@/components/ui";
import { formatEventDate, formatVenue } from "@/lib/formatEvent";
import { getEventWithTiers } from "@/lib/services/events";

/**
 * The landing page.
 *
 * A server component: it reads the event once, on the server, and sends
 * finished HTML. Nothing here ships to the browser, and no database query
 * lives in a component (spec §4) — `getEventWithTiers` does that work.
 *
 * Every word on this page comes from the `events` row, so the admin can
 * change the site without a developer. Sections whose content is empty
 * remove themselves rather than rendering a placeholder.
 */

// Availability changes as people buy, so the page must not be cached
// indefinitely. 60 seconds keeps it fast while stopping a "Sold out" badge
// from being hours stale.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getEventWithTiers();
  if (!data) return { title: "Tickets" };

  const { event } = data;
  const venue = formatVenue(event);
  const description =
    event.description ??
    [formatEventDate(event.date), venue].filter(Boolean).join(" · ");

  return {
    title: { absolute: event.name },
    description,
    openGraph: {
      title: event.name,
      description,
      type: "website",
      locale: "en_NG",
      ...(event.heroImageUrl ? { images: [{ url: event.heroImageUrl }] } : {}),
    },
  };
}

export default async function HomePage() {
  const data = await getEventWithTiers();

  // No published event yet. This is what a fresh install shows, and what the
  // site shows if the admin moves the event back to DRAFT — so it has to be
  // a deliberate state, not a crash.
  if (!data) {
    return (
      <main id="main" className="flex flex-1 items-center py-24">
        <Container width="narrow">
          <EmptyState
            title="Nothing on sale just yet"
            description="The next event has not been announced. Please check back soon."
          />
        </Container>
      </main>
    );
  }

  const { event, tiers } = data;

  return (
    <div id="top">
      <SiteHeader />

      <main id="main">
        <Hero event={event} tiers={tiers} />
        <SectionRule />
        <About event={event} />
        <Programme event={event} />
        <Gallery event={event} />
        <TicketsPreview tiers={tiers} />
        <Sponsor />
        <Faq event={event} />
        <Contact event={event} />
      </main>

      <SiteFooter event={event} />
    </div>
  );
}
