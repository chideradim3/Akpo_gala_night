import "server-only";

import { kobo, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
