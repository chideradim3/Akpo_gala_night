import { z } from "zod";

/**
 * The body of POST /api/payments/confirm.
 *
 * This is the contract the payment developer writes against, so it is
 * deliberately strict: a field that is nearly right should fail loudly here
 * rather than half-work in production.
 */
export const confirmPaymentSchema = z.object({
  /** Our order reference, e.g. GALA-1042. */
  reference: z.string().trim().min(1).max(64),

  /** The provider's own reference. Used for idempotency, so it must be stable. */
  paymentReference: z.string().trim().min(1).max(200),

  /**
   * INTEGER KOBO. ₦5,000 is 500000.
   *
   * Rejecting a float here is the point: a provider sending 5000.00 Naira
   * where we expect kobo would otherwise be recorded as ₦50 and the mismatch
   * check would reject a genuine payment for reasons nobody could work out.
   */
  amountKobo: z
    .number()
    .int("amountKobo must be an integer number of kobo, not Naira and not a decimal")
    .nonnegative(),

  status: z.enum(["success", "failed"]),

  paidAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),

  /** The provider's raw payload, stored for the audit trail. Optional. */
  raw: z.unknown().optional(),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
