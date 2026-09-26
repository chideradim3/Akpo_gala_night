import "server-only";

import { kobo, type Kobo } from "@/lib/money";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type { EventRow, ExperienceEntry, FaqEntry, TicketTypeRow } from "@/types/database";

/**
 * Reading the event and its ticket tiers.
 *
 * All database access lives in files like this one — never inside a React
 * component, and never inside a page file (spec §4). Pages call these and
 * render the result.
 *
 * Everything here reads. Writes arrive in Phase 4 (orders) and Phase 8
 * (admin editing).
 */

/* ── Shapes the UI actually wants ───────────────────────────────────────── */

/**
 * A ticket tier, with its price as branded `Kobo` and its availability and
 * sale window already worked out.
 *
 * The page never sees a raw row, so it cannot accidentally treat
 * `price_kobo` as Naira or forget to check the sale window.
 */
export type TicketTier = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: Kobo;
  admits: number;
  maxPerOrder: number;
  imageUrl: string | null;
  /** How many are still buyable right now. */
  available: number;
  /** Why the tier cannot be bought, or null when it can. */
  unavailableReason: "SOLD_OUT" | "SALES_NOT_OPEN" | "SALES_CLOSED" | null;
};

export type GalaEvent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  address: string | null;
  dressCode: string | null;
  heroImageUrl: string | null;
  gallery: string[];
  about: string | null;
  /** The evening's running order. Empty means the section is hidden. */
  experience: ExperienceEntry[];
  faq: FaqEntry[];
  contactEmail: string | null;
  contactPhone: string | null;
};

/* ── Mapping ────────────────────────────────────────────────────────────── */

/** jsonb comes back as `Json`; narrow it without trusting its shape. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toExperienceEntries(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.title !== "string" || candidate.title.trim() === "") return [];
    return [
      {
        title: candidate.title,
        time: typeof candidate.time === "string" ? candidate.time : undefined,
        description:
          typeof candidate.description === "string" ? candidate.description : undefined,
      },
    ];
  });
}

function toFaqEntries(value: unknown): FaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is FaqEntry => {
    if (typeof entry !== "object" || entry === null) return false;
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.question === "string" && typeof candidate.answer === "string";
  });
}

function toGalaEvent(row: EventRow): GalaEvent {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue,
    address: row.address,
    dressCode: row.dress_code,
    heroImageUrl: row.hero_image_url,
    gallery: toStringArray(row.gallery),
    about: row.about,
    experience: toExperienceEntries(row.experience),
    faq: toFaqEntries(row.faq),
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
  };
}

function saleWindowState(
  row: TicketTypeRow,
  now: Date,
): "SALES_NOT_OPEN" | "SALES_CLOSED" | null {
  if (row.sale_start && new Date(row.sale_start) > now) return "SALES_NOT_OPEN";
  if (row.sale_end && new Date(row.sale_end) <= now) return "SALES_CLOSED";
  return null;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

/**
 * The single published event, or null if none is published yet.
 *
 * The site is built for one gala at a time, so there is deliberately no
 * "which event?" parameter anywhere in the public flow.
 */
export async function getPublishedEvent(): Promise<GalaEvent | null> {
  // Anon client: RLS only ever returns a PUBLISHED event, so the filter below
  // is a second lock rather than the only one.
  const supabase = createPublicSupabaseClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "PUBLISHED")
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the event: ${error.message}`);
  }

  return data ? toGalaEvent(data) : null;
}

/**
 * Active tiers for an event, each with live availability.
 *
 * Availability is a separate call because it must be derived from orders
 * (spec §5 forbids a sold_count column), and that calculation lives in the
 * database where it can be done under a lock at purchase time.
 *
 * Read-only and approximate by nature: a tier showing 1 left may be gone by
 * the time the buyer presses continue. That is fine and expected — the
 * authoritative check happens inside `create_order_with_reservation`, which
 * is the only place that can actually oversell.
 */
export async function getTicketTiers(eventId: string): Promise<TicketTier[]> {
  // Tier details: anon client, so RLS hides inactive tiers and tiers of an
  // unpublished event.
  const publicClient = createPublicSupabaseClient();
  // Availability: must be the service role. Working out what is left means
  // counting orders, which anon cannot read — by design. The function returns
  // only counts, never any order or attendee data.
  const adminClient = createAdminSupabaseClient();

  const [typesResult, availabilityResult] = await Promise.all([
    publicClient
      .from("ticket_types")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminClient.rpc("event_ticket_availability", { p_event_id: eventId }),
  ]);

  if (typesResult.error) {
    throw new Error(`Could not load ticket types: ${typesResult.error.message}`);
  }
  if (availabilityResult.error) {
    throw new Error(`Could not load availability: ${availabilityResult.error.message}`);
  }

  const availableById = new Map<string, number>(
    (availabilityResult.data ?? []).map((row) => [row.ticket_type_id, row.available]),
  );

  const now = new Date();

  return (typesResult.data ?? []).map((row): TicketTier => {
    const available = availableById.get(row.id) ?? 0;
    const windowState = saleWindowState(row, now);

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceKobo: kobo(row.price_kobo),
      admits: row.admits,
      // Never offer more than are left, whatever the configured limit says.
      maxPerOrder: Math.min(row.max_per_order, Math.max(available, 0)),
      imageUrl: row.image_url,
      available: Math.max(available, 0),
      // Sold out is the more useful message when both are true.
      unavailableReason: available <= 0 ? "SOLD_OUT" : windowState,
    };
  });
}

/** The published event together with its tiers — what the landing page needs. */
export async function getEventWithTiers(): Promise<
  { event: GalaEvent; tiers: TicketTier[] } | null
> {
  const event = await getPublishedEvent();
  if (!event) return null;

  const tiers = await getTicketTiers(event.id);
  return { event, tiers };
}
