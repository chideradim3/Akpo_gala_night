/**
 * Money handling for Gala Night.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * Money is ALWAYS stored, passed around and compared as an integer number of
 * kobo. Never a float, never a decimal, never a string of Naira.
 *
 *     ₦5,000     -> 500_000 kobo
 *     ₦200,000   -> 20_000_000 kobo
 *
 * Naira only ever exists at the very edge of the system, for display.
 *
 * Why: 0.1 + 0.2 !== 0.3 in JavaScript. If totals were floats, a large order
 * could be a kobo off, the payment provider's amount would not match ours, and
 * confirmOrderPayment() would correctly reject a legitimate payment. Integers
 * make that class of bug impossible.
 * ──────────────────────────────────────────────────────────────────────────
 */

declare const koboBrand: unique symbol;

/**
 * An integer number of kobo.
 *
 * This is a *branded* number: a plain `number` will not satisfy it without
 * going through one of the constructors below. That makes it a compile-time
 * error to drop a Naira value into a kobo slot — the mistake the rule exists
 * to prevent.
 */
export type Kobo = number & { readonly [koboBrand]: true };

/** Kobo per Naira. */
const KOBO_PER_NAIRA = 100;

/** Guard against nonsense values sneaking in from the database or an API. */
const MAX_KOBO = Number.MAX_SAFE_INTEGER;

/**
 * Treat a raw integer as kobo — use for values that are ALREADY kobo, such as
 * a `price_kobo` column read from Postgres.
 *
 * Throws on anything that is not a safe non-negative integer, so a corrupt or
 * unexpected value fails loudly here rather than silently producing a wrong
 * total three functions later.
 */
export function kobo(value: number): Kobo {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Expected a finite kobo amount, received ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new TypeError(
      `Kobo must be a whole number, received ${value}. Money is never fractional kobo.`,
    );
  }
  if (value < 0) {
    throw new RangeError(`Kobo must not be negative, received ${value}`);
  }
  if (value > MAX_KOBO) {
    throw new RangeError(`Kobo amount ${value} exceeds the safe integer range`);
  }
  return value as Kobo;
}

/**
 * Convert whole Naira to kobo. `nairaToKobo(5000)` -> `500000`.
 *
 * Accepts at most 2 decimal places (₦10.50). Anything finer is rejected rather
 * than rounded, because silently rounding someone's money is how you end up
 * with a total that does not match what they were shown.
 */
export function nairaToKobo(naira: number): Kobo {
  if (!Number.isFinite(naira)) {
    throw new TypeError(`Expected a finite Naira amount, received ${naira}`);
  }
  const exact = naira * KOBO_PER_NAIRA;
  // Floating point: 50.5 * 100 === 5050.000000000001 on some values, so compare
  // against a rounded value within a tolerance instead of using Number.isInteger.
  const rounded = Math.round(exact);
  if (Math.abs(exact - rounded) > 1e-6) {
    throw new TypeError(
      `₦${naira} has more precision than one kobo. Naira amounts may have at most 2 decimal places.`,
    );
  }
  return kobo(rounded);
}

/** Convert kobo back to Naira. Display only — never store or compare this. */
export function koboToNaira(amount: Kobo): number {
  return amount / KOBO_PER_NAIRA;
}

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  // Whole Naira by default: ticket prices are round numbers and "₦200,000.00"
  // is noisier than "₦200,000" on a ticket card.
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const nairaFormatterWithKobo = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format kobo for display. `formatNaira(20_000_000)` -> `"₦200,000"`.
 *
 * If the amount has a non-zero kobo part it is shown in full, so an odd amount
 * is never silently displayed as something the buyer did not pay.
 */
export function formatNaira(amount: Kobo): string {
  const hasKoboPart = amount % KOBO_PER_NAIRA !== 0;
  const formatter = hasKoboPart ? nairaFormatterWithKobo : nairaFormatter;
  // Intl may emit "NGN 200,000" depending on the ICU build shipped with the
  // runtime. Normalise so the naira sign is what users always see.
  return formatter.format(koboToNaira(amount)).replace(/^NGN\s?/, "\u20a6");
}

/** Add kobo amounts. Integer arithmetic only. */
export function sumKobo(...amounts: Kobo[]): Kobo {
  return kobo(amounts.reduce<number>((total, amount) => total + amount, 0));
}

/**
 * Line total for `quantity` units at `unitPrice`.
 * `multiplyKobo(kobo(500_000), 3)` -> `1_500_000` (₦15,000).
 */
export function multiplyKobo(unitPrice: Kobo, quantity: number): Kobo {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative whole number, received ${quantity}`);
  }
  return kobo(unitPrice * quantity);
}
