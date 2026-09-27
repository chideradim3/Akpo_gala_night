import "server-only";

import type { PaymentService } from "./index";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FOR THE PAYMENT DEVELOPER — THIS FILE IS YOURS                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A skeleton, not a working integration. Replace the body of `startPayment`
 * with a call to the provider (Providus Bank or whichever is chosen), then
 * set `PAYMENT_PROVIDER=real`.
 *
 * Nothing else in this repository needs to change, and nothing else imports
 * this file — `getPaymentService()` in ./index.ts loads it only when
 * PAYMENT_PROVIDER is "real".
 *
 * Read PAYMENT_INTEGRATION.md before starting. The short version:
 *
 * 1. OUTGOING — this file. Take the order, ask the provider for a payment
 *    page, return its URL. The buyer is redirected there. Do not mark
 *    anything paid here; you do not yet know that they paid.
 *
 * 2. INCOMING — POST /api/payments/confirm. When the provider confirms,
 *    call that route with an `X-Signature` header: HMAC-SHA256 of the raw
 *    request body using PAYMENT_CONFIRM_SECRET. That route is the ONLY
 *    thing in the system that may mark an order PAID, and it is what
 *    issues the tickets and sends the email.
 *
 * Things that will trip you up if you skip the doc:
 *
 * - `amountKobo` is an INTEGER NUMBER OF KOBO. ₦5,000 is 500000. If the
 *   provider works in Naira, multiply by 100 on the way out and divide on
 *   the way back. The confirm route requires an EXACT match with the order
 *   total and will reject anything else.
 *
 * - `paymentReference` must be stable for a given payment. It is what makes
 *   the confirm route idempotent: send the same one twice and the second
 *   call changes nothing and returns ok. Send a fresh one each retry and
 *   you risk issuing a second set of tickets for one purchase.
 *
 * - Send the buyer to `input.returnUrl` whatever happens — success, failure
 *   or cancellation. That page is read-only; it polls the order status and
 *   shows whatever your confirmation has recorded. It never decides
 *   anything itself.
 *
 * - Add your secrets to `.env.example` (names only) and `.env.local`
 *   (values). Never commit a real key.
 */

export const realPaymentService: PaymentService = {
  async startPayment(input) {
    void input;

    throw new Error(
      "The real payment integration is not implemented yet. " +
        "Implement startPayment in lib/services/payment/real.ts, or set " +
        "PAYMENT_PROVIDER=mock to use the development simulator. " +
        "See PAYMENT_INTEGRATION.md.",
    );

    /*
     * Roughly what it will look like:
     *
     * const response = await fetch("https://provider.example/payments", {
     *   method: "POST",
     *   headers: {
     *     "Content-Type": "application/json",
     *     Authorization: `Bearer ${process.env.PROVIDER_SECRET_KEY}`,
     *   },
     *   body: JSON.stringify({
     *     amount: input.amountKobo,          // confirm the provider's unit!
     *     currency: input.currency,          // "NGN"
     *     reference: input.reference,        // GALA-1042
     *     customer: input.customer,
     *     callback_url: input.returnUrl,
     *   }),
     * });
     *
     * if (!response.ok) {
     *   throw new Error(`Payment provider returned ${response.status}`);
     * }
     *
     * const result = await response.json();
     * return { redirectUrl: result.authorization_url };
     */
  },
};
