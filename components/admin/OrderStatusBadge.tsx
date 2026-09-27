import { Badge, type BadgeTone } from "@/components/ui";
import type { OrderStatus, TicketStatus } from "@/types/database";

/**
 * Status colours, decided once.
 *
 * Defined here rather than at each call site so an order that is PAID
 * looks the same on the dashboard, the orders list and the order page. A
 * status that changes colour between screens quietly teaches people not to
 * trust the colour.
 */

const ORDER_TONE: Record<OrderStatus, BadgeTone> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  REFUNDED: "accent",
};

const TICKET_TONE: Record<TicketStatus, BadgeTone> = {
  ACTIVE: "success",
  USED: "neutral",
  CANCELLED: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{status}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge tone={TICKET_TONE[status]}>{status === "USED" ? "Admitted" : status}</Badge>;
}
