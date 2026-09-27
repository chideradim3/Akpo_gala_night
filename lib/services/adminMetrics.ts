import "server-only";

import { kobo, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/types/database";

/**
 * Numbers for the admin overview (spec §10).
 *
 * Every figure is derived from the orders and tickets themselves. Nothing
 * is cached and no running total is stored anywhere, for the same reason
 * there is no `sold_count` column: a second copy of the truth drifts, and
 * it drifts silently.
 *
 * REVENUE COUNTS PAID ORDERS ONLY. Not pending ones — those are people
 * currently at a payment page who may never finish. A dashboard that adds
 * them in flatters the number and is wrong by exactly the amount that
 * matters most.
 */

export type TierMetrics = {
  ticketTypeId: string;
  name: string;
  priceKobo: Kobo;
  admits: number;
  inventory: number;
  /** Tickets issued, i.e. paid for. */
  sold: number;
  /** Still buyable: inventory minus paid minus unexpired holds. */
  available: number;
  /** Quantity currently held by someone at a payment page. */
  heldPending: number;
  revenueKobo: Kobo;
  /** Of the sold tickets, how many have come through the door. */
  admitted: number;
};

export type SalesDay = { date: string; orders: number; revenueKobo: Kobo };

export type AdminOverview = {
  ticketsSold: number;
  /** Heads through the door if everyone sold turns up. */
  guestCapacitySold: number;
  peopleAdmitted: number;
  ticketsRemaining: number;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  revenueKobo: Kobo;
  tiers: TierMetrics[];
  salesByDay: SalesDay[];
  /**
   * Paid but undeliverable — a late payment on an expired hold. These need
   * a human to refund them, so they are surfaced rather than buried.
   */
  refundsRequired: number;
};

/** Local (Lagos) calendar date for grouping, so a day is a day here. */
function lagosDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export async function getAdminOverview(eventId: string): Promise<AdminOverview> {
  const supabase = createAdminSupabaseClient();

  const [tierResult, availabilityResult, orderResult, itemResult, ticketResult, refundResult] =
    await Promise.all([
      supabase
        .from("ticket_types")
        .select("id, name, price_kobo, admits, inventory, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      supabase.rpc("event_ticket_availability", { p_event_id: eventId }),
      supabase
        .from("orders")
        .select("id, status, total_kobo, paid_at, created_at, payment_reference")
        .eq("event_id", eventId),
      supabase.from("order_items").select("order_id, ticket_type_id, quantity, line_total_kobo"),
      supabase.from("tickets").select("ticket_type_id, status"),
      supabase
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "order.refund_required"),
    ]);

  const tiers = tierResult.data ?? [];
  const orders = orderResult.data ?? [];
  const items = itemResult.data ?? [];
  const tickets = ticketResult.data ?? [];

  const availableById = new Map(
    (availabilityResult.data ?? []).map((row) => [row.ticket_type_id, row.available]),
  );

  const statusById = new Map<string, OrderStatus>(orders.map((order) => [order.id, order.status]));

  const countBy = (status: OrderStatus) => orders.filter((o) => o.status === status).length;

  // ── Per-tier ──────────────────────────────────────────────────────────
  const soldByTier = new Map<string, number>();
  const admittedByTier = new Map<string, number>();
  for (const ticket of tickets) {
    if (ticket.status === "CANCELLED") continue;
    soldByTier.set(ticket.ticket_type_id, (soldByTier.get(ticket.ticket_type_id) ?? 0) + 1);
    if (ticket.status === "USED") {
      admittedByTier.set(ticket.ticket_type_id, (admittedByTier.get(ticket.ticket_type_id) ?? 0) + 1);
    }
  }

  const revenueByTier = new Map<string, number>();
  const heldByTier = new Map<string, number>();
  for (const item of items) {
    const status = statusById.get(item.order_id);
    if (status === "PAID") {
      revenueByTier.set(
        item.ticket_type_id,
        (revenueByTier.get(item.ticket_type_id) ?? 0) + item.line_total_kobo,
      );
    } else if (status === "PENDING") {
      heldByTier.set(item.ticket_type_id, (heldByTier.get(item.ticket_type_id) ?? 0) + item.quantity);
    }
  }

  const tierMetrics: TierMetrics[] = tiers.map((tier) => ({
    ticketTypeId: tier.id,
    name: tier.name,
    priceKobo: kobo(tier.price_kobo),
    admits: tier.admits,
    inventory: tier.inventory,
    sold: soldByTier.get(tier.id) ?? 0,
    available: Math.max(availableById.get(tier.id) ?? 0, 0),
    heldPending: heldByTier.get(tier.id) ?? 0,
    revenueKobo: kobo(revenueByTier.get(tier.id) ?? 0),
    admitted: admittedByTier.get(tier.id) ?? 0,
  }));

  // ── Sales per day ─────────────────────────────────────────────────────
  // Keyed on when the money arrived, not when the order was started.
  const dayMap = new Map<string, { orders: number; revenue: number }>();
  for (const order of orders) {
    if (order.status !== "PAID" || !order.paid_at) continue;
    const day = lagosDate(order.paid_at);
    const entry = dayMap.get(day) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += order.total_kobo;
    dayMap.set(day, entry);
  }

  const salesByDay: SalesDay[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({
      date,
      orders: entry.orders,
      revenueKobo: kobo(entry.revenue),
    }));

  return {
    ticketsSold: tierMetrics.reduce((sum, tier) => sum + tier.sold, 0),
    guestCapacitySold: tierMetrics.reduce((sum, tier) => sum + tier.sold * tier.admits, 0),
    peopleAdmitted: tierMetrics.reduce((sum, tier) => sum + tier.admitted * tier.admits, 0),
    ticketsRemaining: tierMetrics.reduce((sum, tier) => sum + tier.available, 0),
    totalOrders: orders.length,
    paidOrders: countBy("PAID"),
    pendingOrders: countBy("PENDING"),
    failedOrders: countBy("FAILED") + countBy("EXPIRED") + countBy("CANCELLED"),
    revenueKobo: kobo(
      orders.filter((o) => o.status === "PAID").reduce((sum, o) => sum + o.total_kobo, 0),
    ),
    tiers: tierMetrics,
    salesByDay,
    refundsRequired: refundResult.count ?? 0,
  };
}
