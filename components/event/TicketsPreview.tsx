import { Section } from "@/components/event/Section";
import { Badge, ButtonLink, Card, CardBody, EmptyState } from "@/components/ui";
import { formatNairaShort } from "@/lib/money";
import type { TicketTier } from "@/lib/services/events";

/**
 * The ticket tiers, shown on the landing page before checkout.
 *
 * This is a preview, not the checkout: no quantity selectors, no totals.
 * Its job is to answer "what does it cost and what do I get", then send the
 * visitor to /checkout.
 *
 * Availability language is deliberately restrained. "3 left" creates real
 * urgency when true and destroys trust when it is a permanent fixture, so a
 * count only appears when stock is genuinely low.
 */

const LOW_STOCK_THRESHOLD = 5;

function availabilityNote(tier: TicketTier) {
  switch (tier.unavailableReason) {
    case "SOLD_OUT":
      return { tone: "neutral" as const, label: "Sold out" };
    case "SALES_NOT_OPEN":
      return { tone: "neutral" as const, label: "Not yet on sale" };
    case "SALES_CLOSED":
      return { tone: "neutral" as const, label: "Sales closed" };
    default:
      return tier.available <= LOW_STOCK_THRESHOLD
        ? { tone: "warning" as const, label: `${tier.available} left` }
        : null;
  }
}

function TierCard({ tier }: { tier: TicketTier }) {
  const note = availabilityNote(tier);
  const unavailable = tier.unavailableReason !== null;

  return (
    <Card
      as="li"
      className={unavailable ? "opacity-55" : undefined}
      interactive={!unavailable}
    >
      <CardBody className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-[length:var(--text-h3)] font-medium">{tier.name}</h3>
          {note && <Badge tone={note.tone}>{note.label}</Badge>}
        </div>

        <p className="tnum text-[length:var(--text-amount)] leading-none font-medium [font-family:var(--font-display)]">
          {formatNairaShort(tier.priceKobo)}
        </p>

        {/* "Admits 10" is the single most important fact about a VIP table
            and the one most easily missed, so it sits directly under the
            price rather than inside the description. */}
        <p className="eyebrow text-[var(--color-accent-bright)]">
          {tier.admits === 1 ? "Admits one guest" : `Admits ${tier.admits} guests`}
        </p>

        {tier.description && (
          <p className="text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            {tier.description}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function TicketsPreview({ tiers }: { tiers: TicketTier[] }) {
  const anyOnSale = tiers.some((tier) => tier.unavailableReason === null);

  return (
    <Section
      id="tickets"
      eyebrow="Tickets"
      title="Choose your place in the room"
      lead="Prices are per ticket. A table admits your whole party on one ticket."
    >
      {tiers.length === 0 ? (
        <EmptyState
          title="Tickets are not on sale yet"
          description="Check back shortly, or get in touch and we will let you know the moment they are."
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <ButtonLink
              href="/checkout"
              size="lg"
              className="w-full sm:w-auto"
              aria-disabled={!anyOnSale}
            >
              Get your ticket
            </ButtonLink>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {anyOnSale
                ? "Tickets are emailed to you straight after payment."
                : "Every tier is currently unavailable."}
            </p>
          </div>
        </>
      )}
    </Section>
  );
}
