import { TicketTypeEditor } from "@/app/admin/ticket-types/TicketTypeEditor";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEditableEvent } from "@/lib/services/adminEvent";
import { listTicketTypes } from "@/lib/services/adminTicketTypes";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Ticket types");
export const dynamic = "force-dynamic";

export default async function AdminTicketTypesPage() {
  // Owner only: this sets prices and how many exist.
  const admin = await requireAdmin("owner");

  const event = await getEditableEvent();
  if (!event) {
    return (
      <AdminShell admin={admin} current="/admin/ticket-types">
        <EmptyState title="No event yet" description="Create an event before adding tickets." />
      </AdminShell>
    );
  }

  const tiers = await listTicketTypes(event.id);

  return (
    <AdminShell admin={admin} current="/admin/ticket-types">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[length:var(--text-h2)]">Ticket types</h1>
          <p className="max-w-2xl text-sm text-[var(--color-ink-secondary)]">
            Changes appear on the public site immediately. Changing a price never alters an order
            someone has already placed — each order stores what was actually paid.
          </p>
        </div>

        <TicketTypeEditor tiers={tiers} />
      </div>
    </AdminShell>
  );
}
