"use client";

import { Badge, Button, Card, CardBody, EmptyState, QuantitySelector } from "@/components/ui";
import { formatNaira, kobo, multiplyKobo, sumKobo, type Kobo } from "@/lib/money";
import type { TicketTier } from "@/lib/services/events";

/**
 * Step 2 — choosing tiers and quantities.
 *
 * The total shown here is computed in the browser purely so the number
 * updates as you tap. It is never sent anywhere and never trusted: the
 * server recomputes it from the database inside the reservation
 * transaction, and that figure is the one that gets charged (rule 2).
 *
 * There is no promo or sponsor code field, and no subtotal line, because
 * there are no discounts anywhere in this system (spec §3 rule 7). The
 * reference screenshots show both; they are deliberately not reproduced.
 */

const UNAVAILABLE_LABEL: Record<NonNullable<TicketTier["unavailableReason"]>, string> = {
  SOLD_OUT: "Sold out",
  SALES_NOT_OPEN: "Not yet on sale",
  SALES_CLOSED: "Sales closed",
};

function TierRow({
  tier,
  quantity,
  onChange,
}: {
  tier: TicketTier;
  quantity: number;
  onChange: (next: number) => void;
}) {
  const unavailable = tier.unavailableReason !== null;
  const lineTotal = multiplyKobo(tier.priceKobo, quantity);

  return (
    <Card as="li" selected={quantity > 0} className={unavailable ? "opacity-55" : undefined}>
      <CardBody className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold">{tier.name}</h3>
              {unavailable && (
                <Badge>{UNAVAILABLE_LABEL[tier.unavailableReason!]}</Badge>
              )}
              {!unavailable && tier.available <= 5 && (
                <Badge tone="warning">{tier.available} left</Badge>
              )}
            </div>
            <p className="tnum text-sm text-[var(--color-ink-secondary)]">
              {formatNaira(tier.priceKobo)}
              <span className="text-[var(--color-ink-muted)]">
                {" · "}
                {tier.admits === 1 ? "admits 1" : `admits ${tier.admits}`}
              </span>
            </p>
          </div>

          <QuantitySelector
            label={tier.name}
            value={quantity}
            onChange={onChange}
            max={tier.maxPerOrder}
            disabled={unavailable}
          />
        </div>

        {tier.description && (
          <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {tier.description}
          </p>
        )}

        {/* The line total only appears once it means something. */}
        {quantity > 0 && (
          <p className="tnum border-t border-[var(--color-line)] pt-3 text-sm">
            <span className="text-[var(--color-ink-secondary)]">
              {quantity} × {formatNaira(tier.priceKobo)}
            </span>
            <span className="float-right font-semibold">{formatNaira(lineTotal)}</span>
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function SelectTicketsStep({
  tiers,
  quantities,
  onQuantityChange,
  onBack,
  onSubmit,
  submitting,
}: {
  tiers: TicketTier[];
  quantities: Record<string, number>;
  onQuantityChange: (tierId: string, quantity: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const selected = tiers.filter((tier) => (quantities[tier.id] ?? 0) > 0);

  const total: Kobo = selected.length
    ? sumKobo(
        ...selected.map((tier) => multiplyKobo(tier.priceKobo, quantities[tier.id] ?? 0)),
      )
    : kobo(0);

  const ticketCount = selected.reduce((sum, tier) => sum + (quantities[tier.id] ?? 0), 0);
  const guestCount = selected.reduce(
    (sum, tier) => sum + (quantities[tier.id] ?? 0) * tier.admits,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-[length:var(--text-h2)]">Select tickets</h1>
        <p className="text-[var(--color-ink-secondary)]">Choose your tier and quantity.</p>
      </div>

      {tiers.length === 0 ? (
        <EmptyState
          title="Nothing on sale right now"
          description="Tickets are not currently available. Please check back shortly."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {tiers.map((tier) => (
              <TierRow
                key={tier.id}
                tier={tier}
                quantity={quantities[tier.id] ?? 0}
                onChange={(next) => onQuantityChange(tier.id, next)}
              />
            ))}
          </ul>

          <div className="space-y-4 border-t border-[var(--color-line)] pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-[var(--color-ink-muted)]">Total</p>
                {ticketCount > 0 && (
                  <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
                    {ticketCount} {ticketCount === 1 ? "ticket" : "tickets"}
                    {/* Worth stating plainly: one VIP table ticket is ten
                        people through the door, and buyers do miscount it. */}
                    {guestCount !== ticketCount && ` · admits ${guestCount} guests`}
                  </p>
                )}
              </div>
              <p className="tnum text-[length:var(--text-amount)] leading-none font-semibold [font-family:var(--font-display)]">
                {formatNaira(total)}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="ghost" size="lg" onClick={onBack} disabled={submitting}>
                Back
              </Button>
              <Button
                size="lg"
                fullWidth
                onClick={onSubmit}
                loading={submitting}
                disabled={ticketCount === 0}
              >
                {ticketCount === 0 ? "Choose your tickets" : "Continue to payment"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
