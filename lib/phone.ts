/**
 * Nigerian mobile numbers.
 *
 * The database stores exactly one format — `+234XXXXXXXXXX` — enforced by a
 * CHECK constraint. People type several. This is the single place that
 * converts between the two, so the ticket email, the admin search and the
 * order all hold the same string for the same person.
 *
 * Accepted on the way in:
 *   08012345678       the way most people write it
 *   0801 234 5678     with spaces, dashes or brackets
 *   +2348012345678    international
 *   2348012345678     international without the plus
 *   8012345678        the national number alone
 *
 * All of the above become `+2348012345678`.
 */

/**
 * Nigerian mobile numbers begin 070, 080, 081, 090, 091 and so on — after
 * the leading zero the first digit is 7, 8 or 9. Landlines (01…) are not
 * accepted: tickets and updates go by email, but the phone number is what
 * the organiser rings on the night, and it needs to reach a mobile.
 */
const NATIONAL_NUMBER = /^[789]\d{9}$/;

/** Strip everything people use as visual separators. */
function stripFormatting(input: string): string {
  return input.replace(/[\s()\-.]/g, "");
}

/**
 * Normalise to `+234XXXXXXXXXX`, or return null if it is not a valid
 * Nigerian mobile number.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const cleaned = stripFormatting(input.trim());
  if (cleaned === "") return null;

  let national: string;

  if (cleaned.startsWith("+234")) {
    national = cleaned.slice(4);
  } else if (cleaned.startsWith("234")) {
    national = cleaned.slice(3);
  } else if (cleaned.startsWith("0")) {
    national = cleaned.slice(1);
  } else {
    national = cleaned;
  }

  // Anything left that is not a digit means the input was malformed —
  // "+234-abc" for instance. Reject rather than silently dropping characters.
  if (!/^\d+$/.test(national)) return null;
  if (!NATIONAL_NUMBER.test(national)) return null;

  return `+234${national}`;
}

/** True when the input is a usable Nigerian mobile number. */
export function isValidNigerianPhone(input: string): boolean {
  return normalizeNigerianPhone(input) !== null;
}

/**
 * Display form: `0801 234 5678`.
 *
 * Nigerians read their own numbers in the national format, so the admin and
 * the ticket page show that rather than the stored `+234…`.
 */
export function formatNigerianPhone(stored: string): string {
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(stored);
  if (!match) return stored;
  return `0${match[1]} ${match[2]} ${match[3]}`;
}
