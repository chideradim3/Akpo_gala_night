import { z } from "zod";

// Relative rather than the usual "@/lib/…" alias: this module is compiled
// and run directly by the unit tests (tsconfig.test.json), where the alias
// is not resolvable at runtime.
import { normalizeNigerianPhone } from "../phone";

/**
 * What the checkout is allowed to send the server.
 *
 * Every server entry point parses its input through one of these before
 * doing anything else (spec §11). Anything that does not match is rejected
 * with a message a person can act on.
 *
 * Note what is NOT here: prices, totals, ticket names. The browser sends
 * only *which* tier and *how many* — every amount is read from the database
 * on the server (non-negotiable rule 2). There is no field for a price to
 * arrive in, so a tampered page has nothing to tamper with.
 */

/** Longest sensible value for a free-text field, to bound what we store. */
const NAME_MAX = 80;

export const guestDetailsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .max(254, "That email address is too long")
    .pipe(z.email("Enter a valid email address"))
    // Stored lower-cased so one person is one attendee row regardless of how
    // they typed it. The database enforces this too.
    .transform((value) => value.toLowerCase()),

  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name")
    .max(NAME_MAX, "That name is too long"),

  lastName: z
    .string()
    .trim()
    .min(1, "Enter your last name")
    .max(NAME_MAX, "That name is too long"),

  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number")
    .transform((value, ctx) => {
      const normalized = normalizeNigerianPhone(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a Nigerian mobile number, e.g. 08012345678",
        });
        return z.NEVER;
      }
      return normalized;
    }),

  // Nigeria Data Protection Act (spec §7 step 1). Literal `true` rather than
  // boolean: an unticked box must fail validation, not pass as `false`.
  consent: z.literal(true, {
    message: "Please agree to the privacy policy to continue",
  }),
});

export type GuestDetails = z.infer<typeof guestDetailsSchema>;

/** One line of the selection: which tier, how many. No price. */
export const orderItemSchema = z.object({
  ticketTypeId: z.uuid("Unknown ticket type"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    // A generous ceiling purely to stop absurd input reaching the database.
    // The real limit is each tier's max_per_order, enforced in Postgres.
    .max(100, "That is more tickets than we can sell in one order"),
});

export const createOrderSchema = z.object({
  details: guestDetailsSchema,
  items: z
    .array(orderItemSchema)
    .min(1, "Choose at least one ticket")
    .max(20, "Too many different ticket types in one order")
    .refine(
      (items) => new Set(items.map((item) => item.ticketTypeId)).size === items.length,
      // order_items has a unique constraint on (order_id, ticket_type_id), so
      // duplicates would fail deep in a transaction with an opaque error.
      // Catching it here gives a sentence instead.
      { message: "Each ticket type may only appear once in an order" },
    ),
  /** Cloudflare Turnstile response. Absent when bot protection is off. */
  turnstileToken: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Turn a Zod error into `{ fieldName: "message" }` for the form.
 *
 * Only the first problem per field is kept — showing someone three
 * complaints about one input at once is noise.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}
