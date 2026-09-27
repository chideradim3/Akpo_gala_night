import { requireAdmin } from "@/lib/auth/requireAdmin";
import { attendeesToCsv, listAttendees } from "@/lib/services/adminAttendees";
import { getEditableEvent } from "@/lib/services/adminEvent";
import { AUDIT, recordAudit } from "@/lib/services/audit";

/**
 * GET /api/admin/attendees-csv — the guest list as a download.
 *
 * OWNER ONLY, AND LOGGED (spec §10).
 *
 * This is the whole guest list with names, email addresses and phone
 * numbers: the single most sensitive thing the system holds, and the
 * easiest to walk out of the door with. So it is restricted to owners and
 * every export writes an audit row saying who took it and when.
 *
 * requireAdmin redirects rather than returning 403, which is right for a
 * page. For a download that means an unauthorised request gets the login
 * page instead of a file — no data either way.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin("owner");

  const event = await getEditableEvent();
  if (!event) {
    return new Response("No event", { status: 404 });
  }

  const rows = await listAttendees(event.id);
  const csv = attendeesToCsv(rows);

  await recordAudit(admin.userId, AUDIT.attendeesExported, {
    rows: rows.length,
    event: event.slug,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${event.slug}-${stamp}.csv"`,
      // Never let a proxy or the browser keep a copy of the guest list.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
