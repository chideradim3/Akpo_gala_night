import { AdminShell } from "@/components/admin/AdminShell";
import { SalesChart } from "@/components/admin/SalesChart";
import { StatCard } from "@/components/admin/StatCard";
import { Badge, Card, CardBody, DataList, EmptyState, type Column } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { formatNaira } from "@/lib/money";
import { getAdminOverview, type TierMetrics } from "@/lib/services/adminMetrics";
import { getPublishedEvent } from "@/lib/services/events";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Overview");
export const dynamic = "force-dynamic";

const tierColumns: Column<TierMetrics>[] = [
  { key: "name", header: "Ticket type", cell: (t) => t.name, hideOnCard: true },
  { key: "price", header: "Price", align: "right", cell: (t) => formatNaira(t.priceKobo) },
  { key: "sold", header: "Sold", align: "right", cell: (t) => t.sold },
  {
    key: "left",
    header: "Left",
    align: "right",
    cell: (t) =>
      t.available === 0 ? (
        <Badge>Sold out</Badge>
      ) : (
        <span className={t.available <= 5 ? "text-[var(--color-warning)]" : undefined}>
          {t.available}
        </span>
      ),
  },
  { key: "held", header: "In checkout", align: "right", cell: (t) => t.heldPending || "—" },
  { key: "admitted", header: "Admitted", align: "right", cell: (t) => t.admitted },
  { key: "revenue", header: "Revenue", align: "right", cell: (t) => formatNaira(t.revenueKobo) },
];

export default async function AdminOverviewPage() {
  // Every admin page calls this itself. Deliberately not in the layout: a
  // layout does not run for a server action, so a page relying on one is
  // unprotected the moment someone posts directly to its action.
  const admin = await requireAdmin();

  const event = await getPublishedEvent();

  if (!event) {
    return (
      <AdminShell admin={admin} current="/admin">
        <EmptyState
          title="No published event"
          description="Publish an event and its figures will appear here."
        />
      </AdminShell>
    );
  }

  const stats = await getAdminOverview(event.id);

  return (
    <AdminShell admin={admin} current="/admin">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[length:var(--text-h2)]">{event.name}</h1>
          <p className="text-sm text-[var(--color-ink-secondary)]">
            Live figures, worked out from the orders themselves. Revenue counts paid orders only.
          </p>
        </div>

        {stats.refundsRequired > 0 && (
          <Card className="border-[var(--color-warning)]/40">
            <CardBody className="py-4">
              <p className="font-semibold text-[var(--color-warning)]">
                {stats.refundsRequired} payment{stats.refundsRequired === 1 ? "" : "s"} need a
                refund
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
                Paid after the hold expired, once the tickets had gone. No tickets were issued, so
                the money has to be returned by hand.
              </p>
            </CardBody>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenue"
            tone="accent"
            value={formatNaira(stats.revenueKobo)}
            context={`from ${stats.paidOrders} paid order${stats.paidOrders === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Tickets sold"
            value={stats.ticketsSold}
            // A VIP table is one ticket and ten people. The ticket count
            // alone badly understates how full the room is.
            context={`admits ${stats.guestCapacitySold} guest${
              stats.guestCapacitySold === 1 ? "" : "s"
            }`}
          />
          <StatCard label="Tickets left" value={stats.ticketsRemaining} context="across all tiers" />
          <StatCard
            label="Admitted"
            value={stats.peopleAdmitted}
            context={
              stats.guestCapacitySold > 0 ? `of ${stats.guestCapacitySold} expected` : "nobody yet"
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="All orders" value={stats.totalOrders} />
          <StatCard
            label="In checkout now"
            value={stats.pendingOrders}
            tone={stats.pendingOrders > 0 ? "warning" : "default"}
            context="holding seats for 30 minutes"
          />
          <StatCard label="Failed or expired" value={stats.failedOrders} context="seats released" />
        </div>

        <SalesChart days={stats.salesByDay} />

        <section className="space-y-3">
          <h2 className="text-[length:var(--text-h3)]">By ticket type</h2>
          <DataList
            rows={stats.tiers}
            columns={tierColumns}
            getRowKey={(tier) => tier.ticketTypeId}
            cardTitle={(tier) => tier.name}
            cardSubtitle={(tier) => `${formatNaira(tier.priceKobo)} · admits ${tier.admits}`}
            caption="Sales and availability by ticket type"
            emptyTitle="No ticket types yet"
          />
        </section>
      </div>
    </AdminShell>
  );
}
