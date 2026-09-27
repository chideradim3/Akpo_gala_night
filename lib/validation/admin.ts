import { z } from "zod";

/**
 * What the admin forms are allowed to submit.
 *
 * Admins are trusted people, not trusted input. A typo that sets a price to
 * ₦0 or an inventory to −5 does real damage, and the browser is still the
 * browser however senior the person at it.
 *
 * ── MONEY ────────────────────────────────────────────────────────────────
 * These forms take NAIRA, because that is what a person thinks in. The
 * conversion to integer kobo happens here, once, at the boundary — so no
 * page or action further in ever handles a Naira amount by accident.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Blank optional text fields arrive as "" and should be stored as null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

/** A datetime-local input, or nothing. */
const optionalDateTime = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date and time",
  })
  .transform((value) => (value === null ? null : new Date(value).toISOString()));

export const ticketTypeSchema = z
  .object({
    id: z.uuid().optional(),

    name: z.string().trim().min(1, "Give the ticket type a name").max(80),
    description: optionalText(500),

    priceNaira: z.coerce
      .number({ message: "Enter a price in Naira" })
      .min(0, "A price cannot be negative")
      .max(100_000_000, "That price looks wrong")
      // Kobo are whole numbers, so Naira may have at most 2 decimals.
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: "A price can have at most 2 decimal places",
      }),

    admits: z.coerce
      .number({ message: "Enter how many people this admits" })
      .int("Whole people only")
      .min(1, "A ticket must admit at least one person")
      .max(1000),

    inventory: z.coerce
      .number({ message: "Enter how many exist" })
      .int()
      .min(0, "Inventory cannot be negative")
      .max(1_000_000),

    maxPerOrder: z.coerce
      .number({ message: "Enter a maximum per order" })
      .int()
      .min(1, "Someone must be able to buy at least one")
      .max(1000),

    saleStart: optionalDateTime,
    saleEnd: optionalDateTime,
    imageUrl: optionalText(2000),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    isActive: z.coerce.boolean().default(true),
  })
  .refine(
    (value) => !value.saleStart || !value.saleEnd || value.saleEnd > value.saleStart,
    { message: "Sales must end after they start", path: ["saleEnd"] },
  );

export type TicketTypeInput = z.infer<typeof ticketTypeSchema>;

/** Naira in the form, kobo in the database. The one place this happens. */
export function priceToKobo(priceNaira: number): number {
  return Math.round(priceNaira * 100);
}

const faqEntrySchema = z.object({
  question: z.string().trim().min(1, "A question cannot be blank").max(300),
  answer: z.string().trim().min(1, "An answer cannot be blank").max(2000),
});

const experienceEntrySchema = z.object({
  time: z.string().trim().max(40).optional(),
  title: z.string().trim().min(1, "Give this part of the evening a title").max(120),
  description: z.string().trim().max(500).optional(),
});

export const eventSettingsSchema = z
  .object({
    name: z.string().trim().min(1, "The event needs a name").max(120),
    description: optionalText(500),
    about: optionalText(5000),

    date: z
      .string()
      .trim()
      .min(1, "Choose a date")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date"),

    startTime: optionalText(8),
    endTime: optionalText(8),
    venue: optionalText(200),
    address: optionalText(300),
    dressCode: optionalText(120),
    heroImageUrl: optionalText(2000),
    contactEmail: optionalText(254),
    contactPhone: optionalText(40),

    gallery: z.array(z.string().trim().max(2000)).max(24).default([]),
    faq: z.array(faqEntrySchema).max(30).default([]),
    experience: z.array(experienceEntrySchema).max(30).default([]),

    // Publishing is what puts the event on the public site, so it is an
    // explicit choice rather than something that happens by saving.
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  })
  .refine(
    (value) => value.contactEmail === null || z.email().safeParse(value.contactEmail).success,
    { message: "Enter a valid email address", path: ["contactEmail"] },
  );

export type EventSettingsInput = z.infer<typeof eventSettingsSchema>;

/** Filters on the orders list. All optional. */
export const orderFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z
    .enum(["ALL", "PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED"])
    .default("ALL"),
  needsRefund: z.coerce.boolean().default(false),
});

export type OrderFilter = z.infer<typeof orderFilterSchema>;
