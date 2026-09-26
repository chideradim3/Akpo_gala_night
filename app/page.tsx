import { Badge, ButtonLink, Container } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { placeholderEvent, placeholderTicketTypes } from "@/lib/placeholderEvent";

/**
 * PHASE 1 PLACEHOLDER HERO.
 *
 * Its only job is to prove the design tokens, fonts and Container widths work
 * on a real page. Phase 3 replaces this file with the full landing page
 * (Hero · About · Experience · Gallery · Tickets · Dress code · FAQ · Contact
 * · Footer), all of it read from the `events` table so the admin can edit it.
 */
export default function HomePage() {
  const lowestPrice = placeholderTicketTypes.reduce(
    (cheapest, tier) => (tier.priceKobo < cheapest ? tier.priceKobo : cheapest),
    placeholderTicketTypes[0].priceKobo,
  );

  return (
    <main id="main" className="flex flex-1 flex-col justify-center py-20 sm:py-28">
      <Container width="wide">
        {/* Single column on a phone; text and details sit side by side from
            `lg` up so a 1440px laptop is not one tall centred ribbon. */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div className="space-y-7">
            <Badge tone="accent">Sample event · Phase 1 preview</Badge>

            <div className="space-y-5">
              <h1 className="text-[length:var(--text-display)] font-bold">
                {placeholderEvent.name}
              </h1>
              <p className="max-w-xl text-[length:var(--text-body-lg)] leading-relaxed text-[var(--color-ink-secondary)]">
                {placeholderEvent.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href="/checkout"
                size="lg"
                variant="primary"
                className="w-full sm:w-auto"
              >
                Get your ticket
              </ButtonLink>
              <p className="tnum text-sm text-[var(--color-ink-muted)]">
                From {formatNaira(lowestPrice)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-line)] lg:grid-cols-1">
            {[
              { label: "Date", value: placeholderEvent.date },
              { label: "Doors", value: placeholderEvent.startTime },
              { label: "Venue", value: placeholderEvent.venue },
              { label: "Dress code", value: placeholderEvent.dressCode },
            ].map((item) => (
              <div key={item.label} className="bg-[var(--color-surface-raised)] p-5">
                <dt className="eyebrow text-[var(--color-ink-muted)]">{item.label}</dt>
                <dd className="mt-1.5 text-base font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </main>
  );
}
