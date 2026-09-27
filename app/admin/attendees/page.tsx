import { AdminShell } from "@/components/admin/AdminShell";
import { Badge, ButtonLink, Card, CardBody, DataList, type Column } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { formatNaira } from "@/lib/money";
import { listAttendees, type AttendeeRow } from "@/lib/services/adminAttendees";
import { getEditableEvent } from "@/lib/services/adminEvent";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Attendees");
export const dynamic = "force-dynamic";

const columns: Column<AttendeeRow>[] = [
  { key: "name", header: "Name", cell: (a) => a.name, hideOnCard: true },
  {
    key: "contact",
    header: "Contact",
    hideOnCard: true,
    cell: (a) => (
      <div className="min-w-0">
        <p className="truncate text-xs">{a.email}</p>
        <p className="tnum truncate text-xs text-[var(--color-ink-muted)]">{a.phone}</p>
      </div>
    ),
  },
  {
    key: "tickets",
    header: "Tickets",
    align: "right",
    cell: (a) =>
      a.ticketsBought === 0 ? (
        <span className="text-[var(--color-ink-muted)]">—</span>
      ) : (
        <span className="tnum">
          {a.ticketsBought}
          {a.guestsAdmittedBy !== a.ticketsBought && (
            <span className="text-[var(--color-ink-muted)]"> ({a.guestsAdmittedBy})</span>
          )}
        </span>
      ),
  },
  {
    key: "arrived",
    header: "Arrived",
    cell: (a) =>
      a.ticketsBought === 0 ? (
        <span className="text-[var(--color-ink-muted)]">—</span>
      ) : a.checkedIn === 0 ? (
        <Badge>Not yet</Badge>
      ) : a.checkedIn === a.ticketsBought ? (
        <Badge tone="success">All in</Badge>
      ) : (
        <Badge tone="warning">
          {a.checkedIn}/{a.ticketsBought}
        </Badge>
      ),
  },
  {
    key: "orders",
    header: "Orders",
    cell: (a) => (
      <span className="tnum text-xs">
        {a.paidOrders} paid
        {a.pendingOrders > 0 && `, ${a.pendingOrders} pending`}
      </span>
    ),
  },
  { key: "spent", header: "Spent", align: "right", cell: (a) => formatNaira(a.spentKobo) },
];

export default async function AdminAttendeesPage() {
  const admin = await requireAdmin();
  const event = await getEditableEvent();
  const attendees = event ? await listAttendees(event.id) : [];

  const expectedGuests = attendees.reduce((sum, a) => sum + a.guestsAdmittedBy, 0);
  const arrived = attendees.reduce((sum, a) => sum + a.checkedIn, 0);

  return (
    <AdminShell admin={admin} current="/admin/attendees">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[length:var(--text-h2)]">Attendees</h1>
            <p className="text-sm text-[var(--color-ink-secondary)]">
              {attendees.length} {attendees.length === 1 ? "person" : "people"} ·{" "}
              {expectedGuests} guest{expectedGuests === 1 ? "" : "s"} expected
              {arrived > 0 && ` · ${arrived} checked in`}
            </p>
          </div>

          {/* Owner only, and every download is recorded. */}
          {admin.role === "owner" && (
            <ButtonLink href="/api/admin/attendees-csv" variant="ghost" size="sm">
              Export CSV
            </ButtonLink>
          )}
        </div>

        {admin.role === "owner" && (
          <Card>
            <CardBody className="py-3">
              <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
                The export contains names, email addresses and phone numbers. Every download is
                recorded in the audit log with your account against it.
              </p>
            </CardBody>
          </Card>
        )}

        <DataList
          rows={attendees}
          columns={columns}
          getRowKey={(a) => a.id}
          cardTitle={(a) => a.name}
          cardSubtitle={(a) => a.email}
          caption="Attendees"
          emptyTitle="Nobody yet"
          emptyDescription="People appear here once they start a checkout."
        />

        <p className="text-xs text-[var(--color-ink-muted)]">
          The number in brackets after a ticket count is how many people those tickets admit — a
          VIP table is one ticket and ten guests.
        </p>
      </div>
    </AdminShell>
  );
}
