import "server-only";

import { kobo, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { priceToKobo, type TicketTypeInput } from "@/lib/validation/admin";

/**
 * Managing ticket types (spec §10, owner only).
 *
 * ── THE RULE THAT MATTERS ────────────────────────────────────────────────
 * A tier that has orders is NEVER deleted, only deactivated.
 *
 * Deleting one would orphan real tickets, break the revenue figures, and
 * leave a guest holding a ticket for something that no longer exists.
 * Deactivating removes it from sale and leaves the history intact, which
 * is what "we are not selling that any more" actually means.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type AdminTicketType = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: Kobo;
  admits: number;
  inventory: number;
  maxPerOrder: number;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
  imageUrl: string | null;
  sortOrder: number;
  /** Tickets already issued. Non-zero means this can never be deleted. */
  sold: number;
  /** Quantity in orders of any kind — the test for "has history". */
  hasOrders: boolean;
};

export async function listTicketTypes(eventId: string): Promise<AdminTicketType[]> {
  const supabase = createAdminSupabaseClient();

  const [tierResult, ticketResult, itemResult] = await Promise.all([
    supabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase.from("tickets").select("ticket_type_id"),
    supabase.from("order_items").select("ticket_type_id"),
  ]);

  const soldByTier = new Map<string, number>();
  for (const ticket of ticketResult.data ?? []) {
    soldByTier.set(ticket.ticket_type_id, (soldByTier.get(ticket.ticket_type_id) ?? 0) + 1);
  }
  const orderedTiers = new Set((itemResult.data ?? []).map((item) => item.ticket_type_id));

  return (tierResult.data ?? []).map((tier) => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    priceKobo: kobo(tier.price_kobo),
    admits: tier.admits,
    inventory: tier.inventory,
    maxPerOrder: tier.max_per_order,
    saleStart: tier.sale_start,
    saleEnd: tier.sale_end,
    isActive: tier.is_active,
    imageUrl: tier.image_url,
    sortOrder: tier.sort_order,
    sold: soldByTier.get(tier.id) ?? 0,
    hasOrders: orderedTiers.has(tier.id),
  }));
}

export async function createTicketType(
  eventId: string,
  input: TicketTypeInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await createAdminSupabaseClient()
    .from("ticket_types")
    .insert({
      event_id: eventId,
      name: input.name,
      description: input.description,
      price_kobo: priceToKobo(input.priceNaira),
      admits: input.admits,
      inventory: input.inventory,
      max_per_order: input.maxPerOrder,
      sale_start: input.saleStart,
      sale_end: input.saleEnd,
      is_active: input.isActive,
      image_url: input.imageUrl,
      sort_order: input.sortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[admin/ticket-types] create failed", error?.message);
    return { ok: false, error: "Could not create that ticket type." };
  }
  return { ok: true, id: data.id };
}

export async function updateTicketType(
  id: string,
  input: TicketTypeInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminSupabaseClient();

  // Reducing inventory below what is already sold would make availability
  // negative and the dashboard nonsense. Refuse with a useful number.
  const { count: sold } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("ticket_type_id", id)
    .neq("status", "CANCELLED");

  if ((sold ?? 0) > input.inventory) {
    return {
      ok: false,
      error: `${sold} of these are already sold, so inventory cannot be set below ${sold}.`,
    };
  }

  const { error } = await supabase
    .from("ticket_types")
    .update({
      name: input.name,
      description: input.description,
      // Changing a price does NOT touch past orders: order_items stores the
      // price paid at the time, so history stays true.
      price_kobo: priceToKobo(input.priceNaira),
      admits: input.admits,
      inventory: input.inventory,
      max_per_order: input.maxPerOrder,
      sale_start: input.saleStart,
      sale_end: input.saleEnd,
      is_active: input.isActive,
      image_url: input.imageUrl,
      sort_order: input.sortOrder,
    })
    .eq("id", id);

  if (error) {
    console.error("[admin/ticket-types] update failed", error.message);
    return { ok: false, error: "Could not save those changes." };
  }
  return { ok: true };
}

/**
 * Take a tier off sale, or put it back.
 *
 * There is no delete. See the note at the top of this file — a tier with
 * history is part of the record, and the record is not editable.
 */
export async function setTicketTypeActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createAdminSupabaseClient()
    .from("ticket_types")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("[admin/ticket-types] activate failed", error.message);
    return { ok: false, error: "Could not change that ticket type." };
  }
  return { ok: true };
}

/**
 * Delete a tier that has never been ordered.
 *
 * Only for clearing up a mistake made minutes ago. Anything with an order
 * against it is refused, whatever the caller asks for.
 */
export async function deleteUnusedTicketType(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminSupabaseClient();

  const { count } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("ticket_type_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This ticket type has orders against it. Deactivate it instead of deleting it.",
    };
  }

  const { error } = await supabase.from("ticket_types").delete().eq("id", id);
  if (error) {
    console.error("[admin/ticket-types] delete failed", error.message);
    return { ok: false, error: "Could not delete that ticket type." };
  }
  return { ok: true };
}
