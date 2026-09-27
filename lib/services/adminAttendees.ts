import "server-only";

import { formatNigerianPhone } from "@/lib/phone";
import { kobo, koboToNaira, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Attendees, for the admin (spec §10).
 *
 * One row per person, with what they bought and whether they have arrived.
 * Behind `requireAdmin()` — this is the guest list, with phone numbers.
 */

export type AttendeeRow = {
  id: string;
  name: string;
  email: string;
  /** Display form, 0801 234 5678. */
  phone: string;
  ticketsBought: number;
  guestsAdmittedBy: number;
  checkedIn: number;
  paidOrders: number;
  pendingOrders: number;
  spentKobo: Kobo;
  lastOrderAt: string | null;
};

/**
 * Everyone who has ever started an order, with their totals.
 *
 * Four queries and the joining done here rather than one clever SQL
 * statement: the numbers are small (hundreds of people, not millions) and
 * this stays readable when someone asks in six months why a total is what
 * it is.
 */
export async function listAttendees(eventId: string): Promise<AttendeeRow[]> {
  const supabase = createAdminSupabaseClient();

  const [attendeeResult, orderResult, ticketResult, tierResult] = await Promise.all([
    supabase
      .from("attendees")
      .select("id, first_name, last_name, email, phone, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, attendee_id, status, total_kobo, created_at")
      .eq("event_id", eventId),
    supabase.from("tickets").select("attendee_id, ticket_type_id, status"),
    supabase.from("ticket_types").select("id, admits"),
  ]);

  const admitsById = new Map((tierResult.data ?? []).map((t) => [t.id, t.admits]));

  type Totals = {
    paid: number;
    pending: number;
    spent: number;
    last: string | null;
  };
  const byAttendee = new Map<string, Totals>();

  for (const order of orderResult.data ?? []) {
    const totals = byAttendee.get(order.attendee_id) ?? {
      paid: 0,
      pending: 0,
      spent: 0,
      last: null,
    };
    if (order.status === "PAID") {
      totals.paid += 1;
      // Spend counts paid orders only — an abandoned checkout is not money.
      totals.spent += order.total_kobo;
    } else if (order.status === "PENDING") {
      totals.pending += 1;
    }
    if (!totals.last || order.created_at > totals.last) totals.last = order.created_at;
    byAttendee.set(order.attendee_id, totals);
  }

  const ticketTotals = new Map<string, { bought: number; admits: number; used: number }>();
  for (const ticket of ticketResult.data ?? []) {
    if (ticket.status === "CANCELLED") continue;
    const entry = ticketTotals.get(ticket.attendee_id) ?? { bought: 0, admits: 0, used: 0 };
    entry.bought += 1;
    entry.admits += admitsById.get(ticket.ticket_type_id) ?? 1;
    if (ticket.status === "USED") entry.used += 1;
    ticketTotals.set(ticket.attendee_id, entry);
  }

  return (attendeeResult.data ?? [])
    .map((attendee): AttendeeRow => {
      const totals = byAttendee.get(attendee.id);
      const tickets = ticketTotals.get(attendee.id);
      return {
        id: attendee.id,
        name: `${attendee.first_name} ${attendee.last_name}`,
        email: attendee.email,
        phone: formatNigerianPhone(attendee.phone),
        ticketsBought: tickets?.bought ?? 0,
        guestsAdmittedBy: tickets?.admits ?? 0,
        checkedIn: tickets?.used ?? 0,
        paidOrders: totals?.paid ?? 0,
        pendingOrders: totals?.pending ?? 0,
        spentKobo: kobo(totals?.spent ?? 0),
        lastOrderAt: totals?.last ?? null,
      };
    })
    // People who only ever abandoned a checkout are not the guest list.
    .filter((row) => row.paidOrders > 0 || row.pendingOrders > 0);
}

/** One CSV field, escaped. */
function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  // A leading =, +, - or @ makes Excel treat the cell as a formula. A
  // guest called "=cmd" is unlikely, but a spreadsheet that executes its
  // own contents is a known attack and the fix costs one apostrophe.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * The guest list as CSV.
 *
 * Phone numbers are quoted so a spreadsheet does not strip the leading
 * zero \u2014 "0801\u2026" becoming 801 is the classic way a door list stops being
 * usable.
 */
export function attendeesToCsv(rows: AttendeeRow[]): string {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Tickets",
    "Admits",
    "Checked in",
    "Paid orders",
    "Pending orders",
    "Spent (NGN)",
    "Last order",
  ];

  const lines = rows.map((row) =>
    [
      csvCell(row.name),
      csvCell(row.email),
      csvCell(row.phone),
      csvCell(row.ticketsBought),
      csvCell(row.guestsAdmittedBy),
      csvCell(row.checkedIn),
      csvCell(row.paidOrders),
      csvCell(row.pendingOrders),
      csvCell(koboToNaira(row.spentKobo)),
      csvCell(row.lastOrderAt ? new Date(row.lastOrderAt).toISOString() : null),
    ].join(","),
  );

  // CRLF line endings, and a leading BOM so Excel on Windows reads the file
  // as UTF-8 \u2014 without it, a name with an accent arrives as mojibake.
  //
  // The BOM is written as the \uFEFF escape rather than as the character
  // itself. An invisible byte at the start of a string is exactly the kind
  // of thing an editor or a formatter silently strips, and nobody notices
  // until a guest list opens wrong on the night.
  return `\uFEFF${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
}
