import type { GalaEvent } from "@/lib/services/events";

/**
 * Turning database values into the words that appear on the page.
 *
 * Kept out of the components so a date is formatted one way across the
 * landing page, the ticket email and the buyer's ticket — and so it can be
 * tested without rendering anything.
 *
 * Everything is formatted for Lagos (`Africa/Lagos`). Without a fixed time
 * zone, a date rendered on the server in UTC and re-rendered in the browser
 * can differ by a day, which for an event date is the worst possible bug.
 */

const TIME_ZONE = "Africa/Lagos";
const LOCALE = "en-NG";

/** "Saturday, 20 December 2025" */
export function formatEventDate(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** "Sat 20 Dec 2025" — for tight spaces. */
export function formatEventDateShort(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/**
 * Postgres `time` comes back as "19:00:00". Show it as "7:00 PM".
 * Returns null for a missing or unparseable value so callers can hide the row.
 */
export function formatEventTime(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours > 23 || minutes > 59) return null;

  const suffix = hours < 12 ? "AM" : "PM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "7:00 PM – 11:59 PM", or just the start time, or null. */
export function formatEventTimeRange(event: GalaEvent): string | null {
  const start = formatEventTime(event.startTime);
  const end = formatEventTime(event.endTime);
  if (!start) return null;
  return end ? `${start} – ${end}` : start;
}

/** "The Grand Ballroom, Victoria Island, Lagos" */
export function formatVenue(event: GalaEvent): string | null {
  return [event.venue, event.address].filter(Boolean).join(", ") || null;
}

/**
 * The tel: href for a Nigerian number. Stored as +234XXXXXXXXXX, which is
 * already the correct dial format, so this only strips spaces.
 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}
