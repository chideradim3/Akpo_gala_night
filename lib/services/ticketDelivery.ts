import "server-only";

import { siteUrl } from "@/lib/env";
import { buildTicketEmail } from "@/lib/email/ticketEmail";
import { getPublishedEvent } from "@/lib/services/events";
import { sendEmail } from "@/lib/services/notifications";
import { qrDataUrl } from "@/lib/services/qr";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { kobo } from "@/lib/money";

/**
 * Getting tickets to the buyer.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * Sending NEVER creates a ticket. It reads what already exists and puts it
 * in an email (spec §9). Tickets come into being in exactly one place —
 * `issue_tickets_for_order`, inside the payment confirmation — so no amount
 * of resending can produce a second set, and a guest who asks three times
 * gets the same three codes three times.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Two callers: the payment confirmation (send once, on success) and
 * /find-tickets (send again, on request).
 */

type DeliverableOrder = {
  reference: string;
  accessToken: string;
  email: string;
  guestName: string;
  totalKobo: number;
  tickets: Array<{ ticketCode: string; qrToken: string; tierName: string; admits: number }>;
};

/** Read one PAID order and everything needed to email it. */
async function loadDeliverableOrder(orderId: string): Promise<DeliverableOrder | null> {
  const supabase = createAdminSupabaseClient();

  const [orderResult, tierResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, reference, access_token, status, total_kobo, attendee_id")
      .eq("id", orderId)
      .maybeSingle(),
    supabase.from("ticket_types").select("id, name, admits"),
  ]);

  const order = orderResult.data;
  if (!order) return null;

  // Only paid orders have tickets, and only paid orders get emailed.
  if (order.status !== "PAID") return null;

  const [attendeeResult, ticketResult] = await Promise.all([
    supabase
      .from("attendees")
      .select("first_name, last_name, email")
      .eq("id", order.attendee_id)
      .maybeSingle(),
    supabase
      .from("tickets")
      .select("ticket_code, qr_token, ticket_type_id")
      .eq("order_id", order.id)
      // CANCELLED tickets are refunded and must not be emailed as valid.
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: true }),
  ]);

  const attendee = attendeeResult.data;
  if (!attendee) return null;

  const tickets = ticketResult.data ?? [];
  if (tickets.length === 0) return null;

  const tierById = new Map(
    (tierResult.data ?? []).map((tier) => [tier.id, { name: tier.name, admits: tier.admits }]),
  );

  return {
    reference: order.reference,
    accessToken: order.access_token,
    email: attendee.email,
    guestName: `${attendee.first_name} ${attendee.last_name}`,
    totalKobo: order.total_kobo,
    tickets: tickets.map((ticket) => ({
      ticketCode: ticket.ticket_code,
      qrToken: ticket.qr_token,
      tierName: tierById.get(ticket.ticket_type_id)?.name ?? "Ticket",
      admits: tierById.get(ticket.ticket_type_id)?.admits ?? 1,
    })),
  };
}

/**
 * Email one order's tickets.
 *
 * Returns false rather than throwing. The payment confirmation calls this
 * after its transaction has committed, and a mail failure must never undo a
 * payment that succeeded — the buyer can always recover the tickets from
 * /find-tickets, and the admin can resend.
 */
export async function sendTicketsForOrder(
  orderId: string,
  options: { isResend?: boolean } = {},
): Promise<boolean> {
  try {
    const order = await loadDeliverableOrder(orderId);
    if (!order) {
      console.warn("[delivery] nothing to send for order", orderId);
      return false;
    }

    const event = await getPublishedEvent();

    // The QR is a PNG here, not the SVG the web page uses: email clients do
    // not render inline SVG.
    const tickets = await Promise.all(
      order.tickets.map(async (ticket) => ({
        ticketCode: ticket.ticketCode,
        tierName: ticket.tierName,
        admits: ticket.admits,
        qrDataUrl: await qrDataUrl(ticket.qrToken),
      })),
    );

    const email = buildTicketEmail({
      event,
      guestName: order.guestName,
      to: order.email,
      reference: order.reference,
      totalKobo: kobo(order.totalKobo),
      ticketsUrl: new URL(`/tickets/${order.accessToken}`, siteUrl()).toString(),
      tickets,
      isResend: options.isResend,
    });

    const result = await sendEmail(email);

    // Recorded either way: "did the buyer ever get their tickets?" is the
    // first question asked when someone turns up at the door with nothing.
    await createAdminSupabaseClient()
      .from("audit_log")
      .insert({
        actor: "system",
        action: result.ok ? "tickets.emailed" : "tickets.email_failed",
        details: {
          reference: order.reference,
          isResend: options.isResend === true,
          ...(result.ok ? {} : { error: result.error }),
        },
      });

    return result.ok;
  } catch (error) {
    console.error("[delivery] unexpected failure", { orderId, error });
    return false;
  }
}

/**
 * Resend every paid order belonging to an email address.
 *
 * Used by /find-tickets. Two things make this safe to expose publicly:
 *
 *  - It sends only to the address stored ON THE ORDER. The form's input is
 *    used to look orders up, never as a destination, so it cannot be used
 *    to have someone else's tickets delivered elsewhere.
 *  - It returns only a count, and the page ignores even that. Whether an
 *    address has tickets is not something a stranger gets to discover.
 */
export async function resendTicketsForEmail(email: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const normalized = email.trim().toLowerCase();

  const { data: attendee } = await supabase
    .from("attendees")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (!attendee) return 0;

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("attendee_id", attendee.id)
    .eq("status", "PAID");

  if (!orders?.length) return 0;

  let sent = 0;
  for (const order of orders) {
    // Sequential on purpose: a provider will rate-limit a burst, and
    // someone with several orders is rare.
    if (await sendTicketsForOrder(order.id, { isResend: true })) sent += 1;
  }

  return sent;
}
