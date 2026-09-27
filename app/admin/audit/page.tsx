import { AdminShell } from "@/components/admin/AdminShell";
import { Badge, DataList, type Column } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listAudit, type AuditEntry } from "@/lib/services/audit";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Audit log");
export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

/** 'system' and 'payment' are not people; an id is. */
function actorLabel(actor: string) {
  if (actor === "system" || actor === "payment") {
    return <Badge>{actor}</Badge>;
  }
  return <code className="text-xs">{actor.slice(0, 8)}…</code>;
}

const columns: Column<AuditEntry>[] = [
  { key: "when", header: "When", cell: (e) => <span className="whitespace-nowrap">{when(e.createdAt)}</span> },
  { key: "actor", header: "Who", cell: (e) => actorLabel(e.actor) },
  { key: "action", header: "What", cell: (e) => <code className="text-xs">{e.action}</code> },
  {
    key: "details",
    header: "Detail",
    cell: (e) => (
      <code className="block max-w-xl truncate text-xs text-[var(--color-ink-muted)]">
        {JSON.stringify(e.details)}
      </code>
    ),
  },
];

export default async function AdminAuditPage() {
  // Owner only: the trail names who did what, including exports.
  const admin = await requireAdmin("owner");
  const entries = await listAudit(200);

  return (
    <AdminShell admin={admin} current="/admin/audit">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[length:var(--text-h2)]">Audit log</h1>
          <p className="max-w-2xl text-sm text-[var(--color-ink-secondary)]">
            Payments, ticket issuance, price changes, exports and refund flags. Insert-only —
            nothing in this system can edit or delete an entry, including this page.
          </p>
        </div>

        <DataList
          rows={entries}
          columns={columns}
          getRowKey={(e) => String(e.id)}
          cardTitle={(e) => e.action}
          cardSubtitle={(e) => when(e.createdAt)}
          caption="Audit log"
          emptyTitle="Nothing recorded yet"
        />

        <p className="text-xs text-[var(--color-ink-muted)]">Showing the 200 most recent entries.</p>
      </div>
    </AdminShell>
  );
}
