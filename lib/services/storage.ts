import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Image uploads (spec §10).
 *
 * Goes to the public `event-images` bucket created in migration 06. The
 * images are on the public site anyway, so the bucket is readable by
 * anyone — but writing to it happens only here, through the service role,
 * behind `requireAdmin()`. The browser never uploads directly.
 */

const BUCKET = "event-images";

/** What a browser can be trusted to send, checked server-side regardless. */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadEventImage(file: File, prefix: string): Promise<UploadResult> {
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That image is larger than 5 MB. Please compress it first." };
  }

  // Our own name, never the uploaded one: a filename is user input and can
  // carry path separators, control characters or a misleading extension.
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${prefix}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[storage] upload failed", error.message);
    return { ok: false, error: "Could not upload that image. Please try again." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
