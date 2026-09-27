import "server-only";

import { kobo, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { OrderStatus, TicketStatus } from "@/types/database";

/**
 * Orders.
 *
 * Phase 4 covers creating a PENDING order and reserving its inventory.
 * Confirming payment — the only thing that may mark an order PAID — arrives
 * in Phase 5 as `confirmOrderPayment()`.
 */

/** How long a PENDING order holds its seats (spec §6). */
export const ORDER_HOLD_MINUTES = 30;

export type CreatedOrder = {
  orderId: string;
  reference: string;
  accessToken: string;
  totalKobo: Kobo;
  expiresAt: string;
};

export type OrderItemInput = { ticketTypeId: string; quantity: number };

/**
 * The errors `create_order_with_reservation` raises, and what a buyer is
 * told when each happens.
 *
 * The database raises a SQLSTATE; the buyer sees a sentence. Keeping the
 * mapping in one table means the wording can be changed without touching
 * SQL, and a new database error can never leak raw to the screen — anything
 * unrecognised falls through to the generic message.
 */
const DATABASE_ERROR_MESSAGES: Record<string, string> = {
  GN001: "Those tickets just sold out. Please choose another tier or a smaller quantity.",
  GN002: "That is more tickets than we can sell in one order for that tier.",
  GN003: "Tickets for that tier are not on sale right now.",
  GN004: "That ticket type is no longer available.",
  GN005: "Please choose at least one ticket.",
};

const GENERIC_FAILURE =
  "We could not start your order. Please try again in a moment.";

/**
 * An error safe to show a buyer.
 *
 * `code` lets the checkout react — for example refreshing availability after
 * a sold-out failure so the page stops offering what is gone.
 */
export class OrderCreationError extends Error {
  readonly code: string;
  /** The tier the problem relates to, when the database named one. */
  readonly detail: string | null;

  constructor(code: string, message: string, detail: string | null = null) {
    super(message);
    this.name = "OrderCreationError";
    this.code = code;
    this.detail = detail;
  }
}

/** Postgres error shape as it arrives through supabase-js. */
function readPostgresError(error: unknown): { code: string; detail: string | null } | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { code?: unknown; details?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : null;
  if (!code) return null;
  const detail =
    typeof candidate.details === "string" && candidate.details.length > 0
      ? candidate.details
      : null;
  return { code, detail };
}

/**
 * Create a PENDING order and reserve its inventory, atomically.
 *
 * All the real work happens inside the Postgres function: it locks the
 * ticket_types rows, checks availability under that lock, reads the prices
 * from the database, and writes the order and its items in one transaction.
 * Nothing here can oversell, because nothing here decides anything — see
 * `supabase/migrations/…_inventory_and_orders.sql`.
 *
 * Note that `items` carries no prices. The total comes back from the
 * database, computed from what the tiers actually cost (rule 2).
 */
export async function createPendingOrder(input: {
  eventId: string;
  attendeeId: string;
  items: OrderItemInput[];
}): Promise<CreatedOrder> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase.rpc("create_order_with_reservation", {
    p_event_id: input.eventId,
    p_attendee_id: input.attendeeId,
    p_items: input.items.map((item) => ({
      ticket_type_id: item.ticketTypeId,
      quantity: item.quantity,
    })),
    p_hold_minutes: ORDER_HOLD_MINUTES,
  });

  if (error) {
    const pgError = readPostgresError(error);
    const code = pgError?.code ?? "UNKNOWN";
    const friendly = DATABASE_ERROR_MESSAGES[code];

    // Log the real reason; show the buyer the friendly one.
    console.error("[orders] create_order_with_reservation failed", {
      code,
      message: error.message,
      details: pgError?.detail,
    });

    throw new OrderCreationError(code, friendly ?? GENERIC_FAILURE, pgError?.detail ?? null);
  }

  // The function returns a one-row table.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    console.error("[orders] create_order_with_reservation returned no row");
    throw new OrderCreationError("EMPTY_RESULT", GENERIC_FAILURE);
  }

  return {
    orderId: row.order_id,
    reference: row.reference,
    accessToken: row.access_token,
    totalKobo: kobo(row.total_kobo),
    expiresAt: new Date(Date.now() + ORDER_HOLD_MINUTES * 60_000).toISOString(),
  };
}

/**
 * Read an order's status by reference and access token.
 *
 * Used by the payment return page in Phase 5, which polls this and displays
 * the result. It is READ ONLY, deliberately: nothing on any page may mark an
 * order paid (non-negotiable rules 5 and 6).
 */
export async function getOrderStatus(reference: string, accessToken: string) {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, reference, status, total_kobo, expires_at, paid_at")
    .eq("reference", reference)
    // Both must match. The reference alone is short and guessable; the
    // access token is 32 random bytes and is what actually authorises this.
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error) {
    console.error("[orders] getOrderStatus failed", error.message);
    return null;
  }

  return data;
}

/* ────────────────────────────────────────────────────────────────────────
   Payment confirmation — Phase 5
   ──────────────────────────────────────────────────────────────────────── */

export type ConfirmOutcome =
  | "PAID"
  | "ALREADY_PROCESSED"
  | "FAILED_RECORDED"
  | "REFUND_REQUIRED";

export type ConfirmResult = {
  outcome: ConfirmOutcome;
  orderId: string;
  ticketsIssued: number;
};

/** Why a confirmation was refused. The route turns these into HTTP codes. */
const CONFIRM_ERROR_MESSAGES: Record<string, string> = {
  GN101: "No order with that reference",
  GN102: "Order is not awaiting payment",
  GN103: "Paid amount does not match the order total",
  GN104: "That payment reference belongs to a different order",
};

export class PaymentConfirmationError extends Error {
  readonly code: string;
  readonly detail: string | null;

  constructor(code: string, message: string, detail: string | null = null) {
    super(message);
    this.name = "PaymentConfirmationError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Mark an order paid or failed. THE ONLY WAY AN ORDER BECOMES PAID.
 *
 * Reached from exactly one place — POST /api/payments/confirm, behind an
 * HMAC signature check. No page, button or redirect calls this (spec §3
 * rules 5 and 6).
 *
 * The work itself is a single Postgres transaction: status, paid_at,
 * payment_reference, one ticket per unit, and the audit rows all commit
 * together or not at all.
 *
 * Idempotent on `paymentReference`. Providers retry webhooks they think
 * failed; a repeat returns ALREADY_PROCESSED and changes nothing.
 */
export async function confirmOrderPayment(input: {
  reference: string;
  paymentReference: string;
  amountKobo: number;
  status: "success" | "failed";
  paidAt: string;
  raw?: unknown;
}): Promise<ConfirmResult> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase.rpc("confirm_order_payment", {
    p_reference: input.reference,
    p_payment_reference: input.paymentReference,
    p_amount_kobo: input.amountKobo,
    p_status: input.status,
    p_paid_at: input.paidAt,
  });

  if (error) {
    const code = typeof error.code === "string" ? error.code : "UNKNOWN";
    const detail = typeof error.details === "string" ? error.details : null;

    console.error("[payments] confirm_order_payment rejected", {
      reference: input.reference,
      paymentReference: input.paymentReference,
      code,
      message: error.message,
      detail,
    });

    throw new PaymentConfirmationError(
      code,
      CONFIRM_ERROR_MESSAGES[code] ?? "Could not confirm the payment",
      detail,
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new PaymentConfirmationError("EMPTY_RESULT", "Could not confirm the payment");
  }

  // The provider's own payload, kept for the audit trail. Written after the
  // transaction: it is useful for investigating a dispute, but losing it
  // must never roll back a payment that actually succeeded.
  if (input.raw !== undefined) {
    await supabase.from("audit_log").insert({
      actor: "payment",
      action: "payment.raw_payload",
      details: {
        reference: input.reference,
        paymentReference: input.paymentReference,
        raw: input.raw as never,
      },
    });
  }

  return {
    outcome: row.outcome as ConfirmOutcome,
    orderId: row.order_id,
    ticketsIssued: row.tickets_issued,
  };
}

/** One admission ticket, as the ticket page needs it. */
export type IssuedTicket = {
  id: string;
  ticketCode: string;
  qrToken: string;
  status: TicketStatus;
  checkedInAt: string | null;
  tierName: string;
  admits: number;
};

export type OrderWithTickets = {
  id: string;
  reference: string;
  status: OrderStatus;
  totalKobo: Kobo;
  paidAt: string | null;
  guestName: string;
  email: string;
  tickets: IssuedTicket[];
};

/**
 * Everything the buyer's ticket page needs, found by its access token.
 *
 * Two round trips, not four.
 *
 * PostgREST can embed related rows in one query, but only when the generated
 * types describe the foreign keys, and ours are hand-written. So the reads
 * are explicit — and then deliberately batched, because each round trip to
 * Supabase is a real wait on a slow connection and four of them in series
 * made this page take a minute.
 *
 * Hop 1: the order, and every ticket tier (there are a handful, so fetching
 *        them all is cheaper than waiting to learn which ones are needed).
 * Hop 2: the attendee and the tickets.
 */
export async function getOrderByAccessToken(
  accessToken: string,
): Promise<OrderWithTickets | null> {
  const supabase = createAdminSupabaseClient();

  const [orderResult, tierResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, reference, status, total_kobo, paid_at, attendee_id")
      .eq("access_token", accessToken)
      .maybeSingle(),
    supabase.from("ticket_types").select("id, name, admits"),
  ]);

  if (orderResult.error) {
    console.error("[orders] getOrderByAccessToken failed", orderResult.error.message);
    return null;
  }
  const order = orderResult.data;
  if (!order) return null;

  const [attendeeResult, ticketResult] = await Promise.all([
    supabase
      .from("attendees")
      .select("first_name, last_name, email")
      .eq("id", order.attendee_id)
      .maybeSingle(),
    supabase
      .from("tickets")
      .select("id, ticket_code, qr_token, status, checked_in_at, ticket_type_id")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);

  const tierById = new Map(
    (tierResult.data ?? []).map((tier) => [tier.id, { name: tier.name, admits: tier.admits }]),
  );

  const attendee = attendeeResult.data;

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    totalKobo: kobo(order.total_kobo),
    paidAt: order.paid_at,
    guestName: attendee ? `${attendee.first_name} ${attendee.last_name}` : "Guest",
    email: attendee?.email ?? "",
    tickets: (ticketResult.data ?? []).map((ticket) => ({
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      qrToken: ticket.qr_token,
      status: ticket.status,
      checkedInAt: ticket.checked_in_at,
      tierName: tierById.get(ticket.ticket_type_id)?.name ?? "Ticket",
      admits: tierById.get(ticket.ticket_type_id)?.admits ?? 1,
    })),
  };
}
