import { ButtonLink, Container } from "@/components/ui";
import { formatEventDate, formatEventTimeRange, formatVenue } from "@/lib/formatEvent";
import { formatNairaShort } from "@/lib/money";
import type { GalaEvent, TicketTier } from "@/lib/services/events";
import { cn } from "@/lib/utils";

/**
 * The hero, built as an invitation plate rather than a marketing banner.
 *
 * The reasoning: this event has no photography, so a photo-led hero is not
 * available — and a giant centred headline over a gradient is the generic
 * answer every event page gives. A gala's own artifact is the engraved
 * invitation card: hairline rules, the host's name set large in a Didone,
 * and beneath it a formal row of particulars — date, time, place, dress.
 *
 * So the page opens as the invitation the guest is being handed.
 */

/**
 * A short accent segment centred on one of the framing rules.
 *
 * Engraved invitations pair a thick and a thin rule. Reproducing that
 * literally would be heavy on a dark screen, so the weight is expressed as a
 * short brighter run at the centre of an otherwise hairline rule.
 */
function RuleTick({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-1/2 h-px w-16 -translate-x-1/2 bg-[var(--color-accent)] sm:w-24",
        className,
      )}
    />
  );
}

function Particular({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="eyebrow text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-sm leading-snug text-[var(--color-ink)] sm:text-[0.9375rem]">
        {value}
      </dd>
    </div>
  );
}

export function Hero({ event, tiers }: { event: GalaEvent; tiers: TicketTier[] }) {
  const time = formatEventTimeRange(event);
  const venue = formatVenue(event);

  // The cheapest tier SHOWN on this page, whether or not it is on sale
  // today — not the cheapest one currently buyable.
  //
  // Those differ whenever a tier is sold out or its sale window has closed,
  // and the page lists every tier either way. Counting only the buyable ones
  // meant the hero could say "From ₦5K" directly above a visible ₦3K card,
  // which reads as a mistake to anyone scrolling past it.
  const lowestPrice = tiers.length
    ? tiers.reduce((cheapest, tier) => (tier.priceKobo < cheapest ? tier.priceKobo : cheapest), tiers[0].priceKobo)
    : null;

  const particulars = [
    { label: "Date", value: formatEventDate(event.date) },
    time ? { label: "Time", value: time } : null,
    venue ? { label: "Where", value: venue } : null,
    event.dressCode ? { label: "Dress", value: event.dressCode } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <section className="relative isolate overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* A single soft pool of accent light behind the name. Not a gradient
          background — one light source, the way a room is lit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(168,85,247,0.22), transparent 70%)",
        }}
      />

      <Container width="wide">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow text-[var(--color-accent-bright)]">You are invited</p>

          {/* The rules above and below the name are the invitation device.
              They are structural, not decorative: they frame the host name
              exactly as an engraved card does.

              The double rule — hairline above, hairline below, with a short
              accent tick centred on each — is lifted from engraved
              stationery, where a thick/thin pairing is the house style. It is
              the one piece of ornament on the page, so it stays disciplined. */}
          <div className="relative mt-8 border-y border-[var(--color-line-strong)] py-10 sm:py-14">
            <RuleTick className="-top-px" />
            <h1
              className="text-[length:var(--text-display)] leading-[1.02] font-semibold"
              // A Didone is engraved, not printed: at display size the
              // hairlines should be as fine as the face allows. Bodoni Moda
              // carries an optical-size axis that does exactly that, and it
              // is ignored harmlessly if the axis is unavailable.
              style={{ fontVariationSettings: '"opsz" 96', letterSpacing: "0.005em" }}
            >
              {event.name}
            </h1>
            <RuleTick className="-bottom-px" />
          </div>

          {event.description && (
            <p className="mx-auto mt-8 max-w-xl text-[length:var(--text-body-lg)] leading-relaxed text-balance text-[var(--color-ink-secondary)]">
              {event.description}
            </p>
          )}

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <ButtonLink href="/checkout" size="lg" className="w-full sm:w-auto">
              Get your ticket
            </ButtonLink>
            {lowestPrice !== null && (
              <p className="tnum text-sm text-[var(--color-ink-muted)]">
                From {formatNairaShort(lowestPrice)}
              </p>
            )}
          </div>
        </div>

        {/* The particulars. Two columns on a phone so nothing is a lonely
            full-width row; one line across on a laptop, like the foot of a
            printed invitation. */}
        {particulars.length > 0 && (
          <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-8 border-t border-[var(--color-line)] pt-10 sm:mt-20 md:grid-cols-4">
            {particulars.map((item) => (
              <Particular key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>
        )}
      </Container>
    </section>
  );
}
