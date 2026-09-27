"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AUDIT, recordAudit } from "@/lib/services/audit";
import { getOrderDetail, setRefundFlag } from "@/lib/services/adminOrders";
import { sendTicketsForOrder } from "@/lib/services/ticketDelivery";

/**
 * Actions on an order.
 *
 * Each one calls requireAdmin() itself. A server action is a public HTTP
 * endpoint — the page around it having a guard protects the page, not the
 * action, and anyone can post to an action directly.
 */

const referenceSchema = z.string().trim().min(1).max(64);

export type ActionResult = { ok: boolean; message: string };

/** Resend the tickets. Sends the SAME tickets; never issues new ones. */
export async function resendTicketsAction(reference: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("staff");

  const parsed = referenceSchema.safeParse(reference);
  if (!parsed.success) return { ok: false, message: "Unknown order." };

  const order = await getOrderDetail(parsed.data);
  if (!order) return { ok: false, message: "Unknown order." };
  if (order.status !== "PAID" || order.tickets.length === 0) {
    return { ok: false, message: "This order has no tickets to send." };
  }

  const sent = await sendTicketsForOrder(order.id, { isResend: true });

  await recordAudit(admin.userId, AUDIT.ticketsResent, {
    reference: order.reference,
    to: order.email,
    ok: sent,
  });

  revalidatePath(`/admin/orders/${order.reference}`);

  return sent
    ? { ok: true, message: `Tickets sent again to ${order.email}.` }
    : { ok: false, message: "Could not send the email. Check the mail settings and try again." };
}

/**
 * Flag an order as needing a refund, or mark one as handled.
 *
 * This moves no money. Refunding happens in the payment provider, by a
 * person — this only records that it is owed so it is not forgotten.
 */
export async function setRefundFlagAction(input: {
  reference: unknown;
  flagged: boolean;
  reason?: string;
}): Promise<ActionResult> {
  // Owner only: this is money.
  const admin = await requireAdmin("owner");

  const parsed = referenceSchema.safeParse(input.reference);
  if (!parsed.success) return { ok: false, message: "Unknown order." };

  const reason = input.reason?.trim().slice(0, 500) || null;
  const ok = await setRefundFlag(parsed.data, input.flagged, reason);
  if (!ok) return { ok: false, message: "Could not update that order." };

  await recordAudit(
    admin.userId,
    input.flagged ? AUDIT.orderFlaggedForRefund : AUDIT.orderRefundResolved,
    { reference: parsed.data, reason },
  );

  revalidatePath(`/admin/orders/${parsed.data}`);
  revalidatePath("/admin/orders");

  return {
    ok: true,
    message: input.flagged
      ? "Flagged for refund. Refund the payment in your provider's dashboard, then mark it handled."
      : "Marked as handled.",
  };
}
