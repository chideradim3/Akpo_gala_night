import "server-only";

import { kobo, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { OrderStatus, TicketStatus } from "@/types/database";
import type { OrderFilter } from "@/lib/validation/admin";

/**
 * Orders, for the admin (spec §10).
 *
 * Read with the service role, and only ever behind `requireAdmin()`. There
 * is no RLS policy that would let a signed-in user read these directly, so
 * the guard in the calling page is the only thing standing between this
 * data and the internet. Every function here assumes it has already run.
 */

export type OrderSummary = {
  id: string;
  reference: string;
  status: OrderStatus;
  totalKobo: Kobo;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  needsRefund: boolean;
  guestName: string;
  email: string;
  phone: string;
  ticketCount: number;
};

export type OrderDetail = OrderSummary & {
  accessToken: string;
  paymentReference: string | null;
  refundReason: string | null;
  items: Array<{
    tierName: string;
    quantity: number;
    unitPriceKobo: Kobo;
    lineTotalKobo: Kobo;
  }>;
  tickets: Array<{
    id: string;
    ticketCode: string;
    tierName: string;
    admits: number;
    status: TicketStatus;
    checkedInAt: string | null;
  }>;
};

/**
 * Search and filter.
 *
 * The search term is matched against email, phone and reference, because
 * those are the three things a guest on the phone can actually tell you.
 * Phone is matched loosely: they will say "0801 234 5678" while the
 * database holds "+2348012345678".
 */
export async function listOrders(
  eventId: string,
  filter: OrderFilter,
  limit = 200,
): Promise<OrderSummary[]> {
  const supabase = createAdminSupabaseClient();

  let attendeeIds: string[] | null = null;
  let referenceMatch: string | null = null;

  if (filter.q) {
    const term = filter.q.trim();

    // Reference lookups are exact-ish and cheap; try that first.
    referenceMatch = term.toUpperCase().startsWith("GALA-") ? term.toUpperCase() : null;

    // Strip formatting so "0801 234 5678" finds "+2348012345678".
    const digits = term.replace(/\D/g, "");
    const phoneTail = digits.length >= 6 ? digits.slice(-10) : null;

    const filters = [`email.ilike.%${term}%`, `first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`];
    if (phoneTail) filters.push(`phone.ilike.%${phoneTail}%`);

    const { data: matches } = await supabase
      .from("attendees")
      .select("id")
      .or(filters.join(","))
      .limit(500);

    attendeeIds = (matches ?? []).map((row) => row.id);
  }

  let query = supabase
    .from("orders")
    .select(
      "id, reference, status, total_kobo, created_at, paid_at, expires_at, attendee_id, refund_requested_at",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.status !== "ALL") query = query.eq("status", filter.status);
  if (filter.needsRefund) query = query.not("refund_requested_at", "is", null);

  if (filter.q) {
    // Nothing matched a person and it is not a reference: no results,
    // rather than silently ignoring the search.
    if (!referenceMatch && (attendeeIds?.length ?? 0) === 0) return [];
    if (referenceMatch && (attendeeIds?.length ?? 0) === 0) {
      query = query.eq("reference", referenceMatch);
    } else if (referenceMatch) {
      query = query.or(
        `reference.eq.${referenceMatch},attendee_id.in.(${attendeeIds!.join(",")})`,
      );
    } else {
      query = query.in("attendee_id", attendeeIds!);
    }
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error("[admin/orders] list failed", error.message);
    return [];
  }
  if (!orders?.length) return [];

  const [attendeeResult, ticketResult] = await Promise.all([
    supabase
      .from("attendees")
      .select("id, first_name, last_name, email, phone")
      .in("id", [...new Set(orders.map((o) => o.attendee_id))]),
    supabase.from("tickets").select("order_id").in("order_id", orders.map((o) => o.id)),
  ]);

  const attendeeById = new Map((attendeeResult.data ?? []).map((a) => [a.id, a]));
  const ticketCounts = new Map<string, number>();
  for (const ticket of ticketResult.data ?? []) {
    ticketCounts.set(ticket.order_id, (ticketCounts.get(ticket.order_id) ?? 0) + 1);
  }

  return orders.map((order) => {
    const attendee = attendeeById.get(order.attendee_id);
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      totalKobo: kobo(order.total_kobo),
      createdAt: order.created_at,
      paidAt: order.paid_at,
      expiresAt: order.expires_at,
      needsRefund: order.refund_requested_at !== null,
      guestName: attendee ? `${attendee.first_name} ${attendee.last_name}` : "—",
      email: attendee?.email ?? "—",
      phone: attendee?.phone ?? "—",
      ticketCount: ticketCounts.get(order.id) ?? 0,
    };
  });
}

/** One order, in full, by its human-readable reference. */
export async function getOrderDetail(reference: string): Promise<OrderDetail | null> {
  const supabase = createAdminSupabaseClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, reference, access_token, status, total_kobo, created_at, paid_at, expires_at,
       attendee_id, payment_reference, refund_requested_at, refund_reason`,
    )
    .eq("reference", reference)
    .maybeSingle();

  if (!order) return null;

  const [attendeeResult, itemResult, ticketResult, tierResult] = await Promise.all([
    supabase
      .from("attendees")
      .select("first_name, last_name, email, phone")
      .eq("id", order.attendee_id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("ticket_type_id, quantity, unit_price_kobo, line_total_kobo")
      .eq("order_id", order.id),
    supabase
      .from("tickets")
      .select("id, ticket_code, ticket_type_id, status, checked_in_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase.from("ticket_types").select("id, name, admits"),
  ]);

  const tierById = new Map(
    (tierResult.data ?? []).map((t) => [t.id, { name: t.name, admits: t.admits }]),
  );
  const attendee = attendeeResult.data;

  return {
    id: order.id,
    reference: order.reference,
    accessToken: order.access_token,
    status: order.status,
    totalKobo: kobo(order.total_kobo),
    createdAt: order.created_at,
    paidAt: order.paid_at,
    expiresAt: order.expires_at,
    needsRefund: order.refund_requested_at !== null,
    refundReason: order.refund_reason,
    paymentReference: order.payment_reference,
    guestName: attendee ? `${attendee.first_name} ${attendee.last_name}` : "—",
    email: attendee?.email ?? "—",
    phone: attendee?.phone ?? "—",
    ticketCount: ticketResult.data?.length ?? 0,
    items: (itemResult.data ?? []).map((item) => ({
      tierName: tierById.get(item.ticket_type_id)?.name ?? "Ticket",
      quantity: item.quantity,
      unitPriceKobo: kobo(item.unit_price_kobo),
      lineTotalKobo: kobo(item.line_total_kobo),
    })),
    tickets: (ticketResult.data ?? []).map((ticket) => ({
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      tierName: tierById.get(ticket.ticket_type_id)?.name ?? "Ticket",
      admits: tierById.get(ticket.ticket_type_id)?.admits ?? 1,
      status: ticket.status,
      checkedInAt: ticket.checked_in_at,
    })),
  };
}

/**
 * Flag or unflag an order for refund.
 *
 * Note what this does NOT do: move money. Refunding happens in the payment
 * provider's dashboard, by a person. This only records that it is owed, so
 * it does not get forgotten — and clearing the flag records that it was
 * dealt with.
 */
export async function setRefundFlag(
  reference: string,
  flagged: boolean,
  reason: string | null,
): Promise<boolean> {
  const { error } = await createAdminSupabaseClient()
    .from("orders")
    .update({
      refund_requested_at: flagged ? new Date().toISOString() : null,
      refund_reason: flagged ? reason : null,
    })
    .eq("reference", reference);

  if (error) {
    console.error("[admin/orders] refund flag failed", error.message);
    return false;
  }
  return true;
}
