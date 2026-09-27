import Link from "next/link";

import { AdminShell } from "@/components/admin/AdminShell";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Badge, Card, CardBody, DataList, type Column } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { formatNaira } from "@/lib/money";
import { listOrders, type OrderSummary } from "@/lib/services/adminOrders";
import { getEditableEvent } from "@/lib/services/adminEvent";
import { orderFilterSchema } from "@/lib/validation/admin";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Orders");
export const dynamic = "force-dynamic";

const STATUSES = [
  "ALL",
  "PAID",
  "PENDING",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
] as const;

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

const columns: Column<OrderSummary>[] = [
  {
    key: "reference",
    header: "Reference",
    hideOnCard: true,
    cell: (order) => (
      <Link
        href={`/admin/orders/${order.reference}`}
        className="font-semibold underline decoration-[var(--color-accent-line)] underline-offset-4"
      >
        {order.reference}
      </Link>
    ),
  },
  {
    key: "guest",
    header: "Guest",
    hideOnCard: true,
    cell: (order) => (
      <div className="min-w-0">
        <p className="truncate">{order.guestName}</p>
        <p className="truncate text-xs text-[var(--color-ink-muted)]">{order.email}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (order) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status={order.status} />
        {order.needsRefund && <Badge tone="warning">Refund</Badge>}
      </span>
    ),
  },
  { key: "tickets", header: "Tickets", align: "right", cell: (order) => order.ticketCount || "—" },
  {
    key: "total",
    header: "Total",
    align: "right",
    cell: (order) => formatNaira(order.totalKobo),
  },
  {
    key: "placed",
    header: "Placed",
    cell: (order) => <span className="whitespace-nowrap">{when(order.createdAt)}</span>,
  },
];

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  const admin = await requireAdmin();
  const params = await props.searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const filter = orderFilterSchema.parse({
    q: first(params.q) ?? undefined,
    status: first(params.status) ?? "ALL",
    needsRefund: first(params.needsRefund) === "1",
  });

  const event = await getEditableEvent();
  const orders = event ? await listOrders(event.id, filter) : [];

  const refundCount = orders.filter((order) => order.needsRefund).length;

  return (
    <AdminShell admin={admin} current="/admin/orders">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[length:var(--text-h2)]">Orders</h1>
          <p className="text-sm text-[var(--color-ink-secondary)]">
            {orders.length} shown{filter.q ? ` for “${filter.q}”` : ""}
            {refundCount > 0 && ` · ${refundCount} awaiting refund`}
          </p>
        </div>

        <Card>
          <CardBody className="p-4 sm:p-5">
            {/* A plain GET form: the filters end up in the URL, so a search
                can be bookmarked, shared with a colleague, and survives a
                reload. No client state needed. */}
            <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label htmlFor="q" className="block text-sm font-medium">
                  Search
                </label>
                <input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={filter.q ?? ""}
                  placeholder="Email, phone, name or GALA-1042"
                  className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-inset)] px-4 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="status" className="block text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={filter.status}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-inset)] px-4 text-base sm:w-40 sm:text-sm"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "All statuses" : status}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex h-11 items-center gap-2 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  name="needsRefund"
                  value="1"
                  defaultChecked={filter.needsRefund}
                  className="size-4 accent-[var(--color-accent)]"
                />
                Needs refund
              </label>

              <button
                type="submit"
                className="h-11 shrink-0 rounded-[var(--radius-pill)] bg-white px-6 text-sm font-semibold text-[var(--color-ink-inverse)]"
              >
                Apply
              </button>
            </form>
          </CardBody>
        </Card>

        <DataList
          rows={orders}
          columns={columns}
          getRowKey={(order) => order.id}
          cardTitle={(order) => (
            <Link href={`/admin/orders/${order.reference}`} className="underline underline-offset-4">
              {order.reference}
            </Link>
          )}
          cardSubtitle={(order) => `${order.guestName} · ${order.email}`}
          caption="Orders"
          emptyTitle={filter.q ? "No orders match that search" : "No orders yet"}
          emptyDescription={
            filter.q
              ? "Try an email address, a phone number, or a reference like GALA-1042."
              : "Orders appear here as soon as someone starts a checkout."
          }
        />
      </div>
    </AdminShell>
  );
}
