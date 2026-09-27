import { notFound } from "next/navigation";

import { TicketCard } from "@/components/tickets/TicketCard";
import { Badge, ButtonLink, Card, CardBody, Container } from "@/components/ui";
import { formatEventDate, formatEventTimeRange, formatVenue } from "@/lib/formatEvent";
import { formatNaira } from "@/lib/money";
import { getPublishedEvent } from "@/lib/services/events";
import { getOrderByAccessToken } from "@/lib/services/orders";
import { qrSvg } from "@/lib/services/qr";
import { noindexMetadata } from "@/lib/utils";

/**
 * The buyer's tickets.
 *
 * The URL contains a 32-byte random access token and that is the entire
 * authorisation — no login, because the buyer never made an account. Anyone
 * with the link can see these tickets, which is exactly how a ticket works:
 * whoever holds it can use it.
 *
 * Consequences, both handled: the page is `noindex` so it never reaches a
 * search engine, and the QR codes encode only an opaque token, so a
 * forwarded screenshot exposes nothing about the guest.
 */

export const metadata = noindexMetadata("Your tickets");

// Ticket status changes at the door, so this must never be cached.
export const dynamic = "force-dynamic";

export default async function TicketsPage(props: PageProps<"/tickets/[accessToken]">) {
  const { accessToken } = await props.params;

  // Next hands dynamic params through PERCENT-ENCODED. Access tokens are
  // base64url and can end in "=", which arrives as "%3D" — so a valid ticket
  // link 404s unless it is decoded first. Wrapped because a malformed
  // sequence makes decodeURIComponent throw.
  let token: string;
  try {
    token = decodeURIComponent(accessToken);
  } catch {
    notFound();
  }

  // Both are independent reads; waiting for them in series doubles the time
  // the buyer stares at a spinner.
  const [order, event] = await Promise.all([
    getOrderByAccessToken(token),
    getPublishedEvent(),
  ]);

  // A wrong or expired token gets a plain 404 — the same response as a
  // token that never existed, so the page cannot be used to test whether a
  // given token is real.
  if (!order) notFound();

  const tickets = order.tickets;

  // An order that is not paid has no tickets. Say what is happening rather
  // than showing an empty page.
  if (order.status !== "PAID" || tickets.length === 0) {
    return (
      <main id="main" className="flex flex-1 items-center py-20">
        <Container width="narrow">
          <Card>
            <CardBody className="space-y-4 text-center">
              <Badge tone={order.status === "PENDING" ? "warning" : "neutral"}>
                {order.status}
              </Badge>
              <h1 className="text-[length:var(--text-h2)]">No tickets on this order yet</h1>
              <p className="text-[var(--color-ink-secondary)]">
                {order.status === "PENDING"
                  ? "This order has not been paid for yet. If you have just paid, give it a moment and refresh."
                  : "This order was not completed, so no tickets were issued."}
              </p>
              <div className="pt-2">
                <ButtonLink href="/checkout" variant="ghost">
                  Buy tickets
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </Container>
      </main>
    );
  }

  // Generated on the server, so no QR library is shipped to the browser.
  const qrCodes = await Promise.all(tickets.map((ticket) => qrSvg(ticket.qrToken)));

  const eventLine = event
    ? [formatEventDate(event.date), formatEventTimeRange(event), formatVenue(event)]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <main id="main" className="py-12 sm:py-16">
      <Container width="medium" className="space-y-8">
        <header className="space-y-3 text-center">
          <Badge tone="success">Paid</Badge>
          <h1 className="text-[length:var(--text-h1)]">
            {event?.name ?? "Your tickets"}
          </h1>
          {eventLine && (
            <p className="text-[var(--color-ink-secondary)]">{eventLine}</p>
          )}
          <p className="tnum text-sm text-[var(--color-ink-muted)]">
            {order.guestName} · {order.reference} · {formatNaira(order.totalKobo)}
          </p>
        </header>

        {/* Said plainly and early: the commonest failure at a door is a flat
            battery or no signal, and a screenshot solves both. */}
        <Card>
          <CardBody className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-ink-secondary)]">
              <span className="font-semibold text-[var(--color-ink)]">
                Screenshot these now.
              </span>{" "}
              You will not need signal at the door, and they have also been emailed to you.
            </p>
            <ButtonLink href="/find-tickets" variant="ghost" size="sm">
              Email them again
            </ButtonLink>
          </CardBody>
        </Card>

        {/* One per screen on a phone, two across on a laptop. */}
        <ul className="grid gap-5 md:grid-cols-2">
          {tickets.map((ticket, index) => (
            <TicketCard
              key={ticket.id}
              guestName={order.guestName}
              tierName={ticket.tierName}
              admits={ticket.admits}
              ticketCode={ticket.ticketCode}
              status={ticket.status}
              checkedInAt={ticket.checkedInAt}
              qrSvgMarkup={qrCodes[index]}
            />
          ))}
        </ul>

        <p className="text-center text-xs leading-relaxed text-[var(--color-ink-muted)]">
          Each code admits its guests once. Keep this link private — anyone who has it can see
          these tickets.
        </p>
      </Container>
    </main>
  );
}
