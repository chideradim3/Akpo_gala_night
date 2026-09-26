import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { GuestDetails } from "@/lib/validation/checkout";

/**
 * Attendees — the people buying tickets.
 *
 * One row per email address (spec §5). Someone who buys again next year is
 * the same attendee, with their name and phone refreshed to whatever they
 * typed most recently.
 *
 * Uses the service role because this is a write, and the browser never
 * writes to the database. Callers must have validated their input with
 * `guestDetailsSchema` first — this function trusts what it is given.
 */

/**
 * Create the attendee, or update the existing one with the same email.
 *
 * Done as a single upsert rather than select-then-insert: two people
 * checking out with the same email at the same moment would both find no
 * row and both try to insert, and the second would hit the unique
 * constraint. The upsert lets Postgres settle it.
 */
export async function upsertAttendee(details: GuestDetails): Promise<string> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("attendees")
    .upsert(
      {
        // Already lower-cased by the schema; the database also enforces it.
        email: details.email,
        first_name: details.firstName,
        last_name: details.lastName,
        phone: details.phone,
      },
      { onConflict: "email" },
    )
    .select("id")
    .single();

  if (error || !data) {
    // The caller turns this into a friendly message. The detail stays in
    // the server log, never on the screen (spec §11).
    throw new Error(`Could not save guest details: ${error?.message ?? "no row returned"}`);
  }

  return data.id;
}
