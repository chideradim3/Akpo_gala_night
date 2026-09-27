import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { EventSettingsInput } from "@/lib/validation/admin";
import type { EventRow, Json } from "@/types/database";

/**
 * Editing the event (spec §10, owner only).
 *
 * Every word on the public site comes from this row, which is the whole
 * point: the organiser changes the site without a developer.
 */

/**
 * The event to edit — the single one, published or not.
 *
 * Uses the service role, unlike the public read, because a DRAFT event is
 * exactly what the admin needs to see and RLS hides it from everyone else.
 */
export async function getEditableEvent(): Promise<EventRow | null> {
  const { data, error } = await createAdminSupabaseClient()
    .from("events")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[admin/event] read failed", error.message);
    return null;
  }
  return data;
}

export async function updateEvent(
  id: string,
  input: EventSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createAdminSupabaseClient()
    .from("events")
    .update({
      name: input.name,
      description: input.description,
      about: input.about,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue,
      address: input.address,
      dress_code: input.dressCode,
      hero_image_url: input.heroImageUrl,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      gallery: input.gallery as Json,
      faq: input.faq as Json,
      experience: input.experience as Json,
      status: input.status,
    })
    .eq("id", id);

  if (error) {
    console.error("[admin/event] update failed", error.message);
    return { ok: false, error: "Could not save those changes." };
  }
  return { ok: true };
}
