"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEditableEvent, updateEvent } from "@/lib/services/adminEvent";
import { AUDIT, recordAudit } from "@/lib/services/audit";
import { eventSettingsSchema } from "@/lib/validation/admin";

export type EventSaveResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fields?: Record<string, string> };

/**
 * Save the event. Owner only.
 *
 * This is everything on the public site, so a successful save revalidates
 * the landing page — otherwise the organiser changes the venue, reloads,
 * and sees the old one for up to a minute and assumes it did not work.
 */
export async function saveEventAction(raw: unknown): Promise<EventSaveResult> {
  const admin = await requireAdmin("owner");

  const parsed = eventSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !(key in fields)) fields[key] = issue.message;
    }
    return { ok: false, message: "Please check the fields below.", fields };
  }

  const event = await getEditableEvent();
  if (!event) return { ok: false, message: "There is no event to update." };

  const result = await updateEvent(event.id, parsed.data);
  if (!result.ok) return { ok: false, message: result.error };

  await recordAudit(admin.userId, AUDIT.eventUpdated, {
    name: parsed.data.name,
    status: parsed.data.status,
  });

  revalidatePath("/");
  revalidatePath("/admin/event");

  return {
    ok: true,
    message:
      parsed.data.status === "PUBLISHED"
        ? "Saved and live on the site."
        : "Saved. The event is not published, so the public site shows nothing.",
  };
}
