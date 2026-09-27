import { EventSettingsForm } from "@/app/admin/event/EventSettingsForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEditableEvent } from "@/lib/services/adminEvent";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Event settings");
export const dynamic = "force-dynamic";

export default async function AdminEventPage() {
  const admin = await requireAdmin("owner");
  const event = await getEditableEvent();

  if (!event) {
    return (
      <AdminShell admin={admin} current="/admin/event">
        <EmptyState
          title="No event in the database"
          description="Run the seed, or add a row to the events table, and it will appear here."
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell admin={admin} current="/admin/event">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[length:var(--text-h2)]">Event settings</h1>
          <p className="max-w-2xl text-sm text-[var(--color-ink-secondary)]">
            Everything the public site says comes from here. A section with nothing in it hides
            itself rather than showing an empty space.
          </p>
        </div>

        <EventSettingsForm event={event} />
      </div>
    </AdminShell>
  );
}
