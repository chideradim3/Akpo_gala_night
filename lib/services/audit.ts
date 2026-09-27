import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * The audit trail (spec §5).
 *
 * Insert-only. Nothing in this file updates or deletes, there is no
 * function anywhere that does, and RLS blocks it for everyone but the
 * service role. A trail that can be edited after the fact is not a trail.
 *
 * Recorded: payments, ticket issuance, ticket type changes, event setting
 * changes, exports, refund flags — and check-ins, once the payment
 * developer's page writes them.
 */

/**
 * Stable, greppable action names. Strings would drift into
 * "ticketType.updated" and "ticket_type_updated" meaning the same thing.
 */
export const AUDIT = {
  ticketTypeCreated: "ticket_type.created",
  ticketTypeUpdated: "ticket_type.updated",
  ticketTypeDeactivated: "ticket_type.deactivated",
  ticketTypeReactivated: "ticket_type.reactivated",
  eventUpdated: "event.updated",
  orderFlaggedForRefund: "order.flagged_for_refund",
  orderRefundResolved: "order.refund_resolved",
  ticketsResent: "tickets.resent",
  attendeesExported: "attendees.exported",
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];

/**
 * Write one entry.
 *
 * Never throws. An audit write failing must not roll back the thing it is
 * describing — losing the note is bad, losing the price change because the
 * note failed is worse.
 */
export async function recordAudit(
  actor: string,
  action: AuditAction | string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await createAdminSupabaseClient()
      .from("audit_log")
      .insert({ actor, action, details: details as Json });
  } catch (error) {
    console.error("[audit] could not record entry", { action, error });
  }
}

export type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  details: Json;
  createdAt: string;
};

/** Most recent entries first. */
export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await createAdminSupabaseClient()
    .from("audit_log")
    .select("id, actor, action, details, created_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[audit] could not read entries", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
  }));
}
