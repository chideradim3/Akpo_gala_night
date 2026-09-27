import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions } from "@/app/admin/orders/[reference]/OrderActions";
import { AdminShell } from "@/components/admin/AdminShell";
import { OrderStatusBadge, TicketStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Badge, Card, CardBody } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { formatNaira } from "@/lib/money";
import { formatNigerianPhone } from "@/lib/phone";
import { getOrderDetail } from "@/lib/services/adminOrders";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Order");
export const dynamic = "force-dynamic";

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--color-line)] py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="eyebrow pt-1 text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage(
  props: PageProps<"/admin/orders/[reference]">,
) {
  const admin = await requireAdmin();
  const { reference } = await props.params;

  const order = await getOrderDetail(decodeURIComponent(reference));
  if (!order) notFound();

  return (
    <AdminShell admin={admin} current="/admin/orders">
      <div className="space-y-6">
        <div className="space-y-3">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]"
          >
            <span aria-hidden>&larr;</span> All orders
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[length:var(--text-h2)]">{order.reference}</h1>
            <OrderStatusBadge status={order.status} />
            {order.needsRefund && <Badge tone="warning">Refund owed</Badge>}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <Card>
              <CardBody>
                <h2 className="mb-2 text-[length:var(--text-h3)]">Customer</h2>
                <dl>
                  <Row label="Name" value={order.guestName} />
                  <Row
                    label="Email"
                    value={
                      <a href={`mailto:${order.email}`} className="underline underline-offset-4">
                        {order.email}
                      </a>
                    }
                  />
                  <Row
                    label="Phone"
                    value={
                      order.phone === "—" ? (
                        "—"
                      ) : (
                        <a href={`tel:${order.phone}`} className="underline underline-offset-4">
                          {formatNigerianPhone(order.phone)}
                        </a>
                      )
                    }
                  />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="mb-2 text-[length:var(--text-h3)]">Order</h2>
                <dl>
                  {order.items.map((item) => (
                    <Row
                      key={item.tierName}
                      label={item.tierName}
                      value={
                        <span className="tnum">
                          {item.quantity} × {formatNaira(item.unitPriceKobo)} ={" "}
                          <strong>{formatNaira(item.lineTotalKobo)}</strong>
                        </span>
                      }
                    />
                  ))}
                  <Row
                    label="Total"
                    value={<strong className="tnum">{formatNaira(order.totalKobo)}</strong>}
                  />
                  <Row label="Placed" value={when(order.createdAt)} />
                  <Row label="Paid" value={when(order.paidAt)} />
                  {order.status === "PENDING" && (
                    <Row label="Hold expires" value={when(order.expiresAt)} />
                  )}
                  <Row
                    label="Payment ref"
                    value={
                      order.paymentReference ? (
                        <code className="tnum text-xs">{order.paymentReference}</code>
                      ) : (
                        "—"
                      )
                    }
                  />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[length:var(--text-h3)]">
                    Tickets ({order.tickets.length})
                  </h2>
                  {order.status === "PAID" && order.tickets.length > 0 && (
                    <Link
                      href={`/tickets/${order.accessToken}`}
                      className="text-sm text-[var(--color-accent-bright)] underline underline-offset-4"
                    >
                      Open the buyer&apos;s ticket page
                    </Link>
                  )}
                </div>

                {order.tickets.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-secondary)]">
                    No tickets. They are only issued once an order is paid.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {order.tickets.map((ticket) => (
                      <li
                        key={ticket.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-line)] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="tnum font-semibold tracking-wider">{ticket.ticketCode}</p>
                          <p className="text-xs text-[var(--color-ink-muted)]">
                            {ticket.tierName} · admits {ticket.admits}
                            {ticket.checkedInAt && ` · used ${when(ticket.checkedInAt)}`}
                          </p>
                        </div>
                        <TicketStatusBadge status={ticket.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <OrderActions
              reference={order.reference}
              email={order.email}
              canResend={order.status === "PAID" && order.tickets.length > 0}
              needsRefund={order.needsRefund}
              refundReason={order.refundReason}
              isOwner={admin.role === "owner"}
            />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
