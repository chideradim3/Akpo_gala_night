"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEditableEvent } from "@/lib/services/adminEvent";
import {
  createTicketType,
  deleteUnusedTicketType,
  setTicketTypeActive,
  updateTicketType,
} from "@/lib/services/adminTicketTypes";
import { AUDIT, recordAudit } from "@/lib/services/audit";
import { uploadEventImage } from "@/lib/services/storage";
import { ticketTypeSchema } from "@/lib/validation/admin";

export type SaveResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fields?: Record<string, string> };

/**
 * Create or update a tier. Owner only — this sets prices.
 *
 * Changing a price never touches past orders: order_items stores what was
 * actually paid at the time, so raising a price tomorrow does not rewrite
 * yesterday's revenue.
 */
export async function saveTicketTypeAction(raw: unknown): Promise<SaveResult> {
  const admin = await requireAdmin("owner");

  const parsed = ticketTypeSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !(key in fields)) fields[key] = issue.message;
    }
    return { ok: false, message: "Please check the fields below.", fields };
  }

  const event = await getEditableEvent();
  if (!event) return { ok: false, message: "No event to attach this to." };

  const input = parsed.data;

  if (input.id) {
    const result = await updateTicketType(input.id, input);
    if (!result.ok) return { ok: false, message: result.error };
    await recordAudit(admin.userId, AUDIT.ticketTypeUpdated, {
      id: input.id,
      name: input.name,
      priceNaira: input.priceNaira,
      inventory: input.inventory,
    });
  } else {
    const result = await createTicketType(event.id, input);
    if (!result.ok) return { ok: false, message: result.error };
    await recordAudit(admin.userId, AUDIT.ticketTypeCreated, {
      id: result.id,
      name: input.name,
      priceNaira: input.priceNaira,
      inventory: input.inventory,
    });
  }

  revalidatePath("/admin/ticket-types");
  revalidatePath("/");
  return { ok: true, message: input.id ? "Saved." : `Created “${input.name}”.` };
}

/** Take a tier off sale, or put it back. Never deletes. */
export async function setActiveAction(input: {
  id: unknown;
  isActive: boolean;
}): Promise<SaveResult> {
  const admin = await requireAdmin("owner");

  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, message: "Unknown ticket type." };

  const result = await setTicketTypeActive(id.data, input.isActive);
  if (!result.ok) return { ok: false, message: result.error };

  await recordAudit(
    admin.userId,
    input.isActive ? AUDIT.ticketTypeReactivated : AUDIT.ticketTypeDeactivated,
    { id: id.data },
  );

  revalidatePath("/admin/ticket-types");
  revalidatePath("/");
  return {
    ok: true,
    message: input.isActive ? "Back on sale." : "Taken off sale. Existing tickets are unaffected.",
  };
}

/** Only for a tier nobody has ever ordered. The service refuses otherwise. */
export async function deleteTicketTypeAction(rawId: unknown): Promise<SaveResult> {
  const admin = await requireAdmin("owner");

  const id = z.uuid().safeParse(rawId);
  if (!id.success) return { ok: false, message: "Unknown ticket type." };

  const result = await deleteUnusedTicketType(id.data);
  if (!result.ok) return { ok: false, message: result.error };

  await recordAudit(admin.userId, "ticket_type.deleted", { id: id.data });
  revalidatePath("/admin/ticket-types");
  revalidatePath("/");
  return { ok: true, message: "Deleted." };
}

/** Upload an image and return its public URL for the form to store. */
export async function uploadImageAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin("owner");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }

  return uploadEventImage(file, String(formData.get("prefix") ?? "misc"));
}
