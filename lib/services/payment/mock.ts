import "server-only";

import { devRoutesEnabled } from "@/lib/utils";
import type { PaymentService } from "./index";

/**
 * DEVELOPMENT ONLY. Delete these files once the real integration works.
 *
 * Stands in for the payment provider so the whole flow can be exercised
 * today: it sends the buyer to /dev/mock-payment, where you press
 * "Simulate success" or "Simulate failure".
 *
 * The important part is what that page then does. It calls the REAL
 * `/api/payments/confirm` route with a REAL HMAC signature — exactly what
 * the payment developer's system will do. So the thing being tested is the
 * production path, not a shortcut around it. If tickets are issued and
 * emailed correctly here, they will be issued and emailed correctly then.
 *
 * Nothing imports this directly except `getPaymentService()`, and only when
 * PAYMENT_PROVIDER is not "real".
 */

export const devMockPaymentService: PaymentService = {
  async startPayment(input) {
    if (!devRoutesEnabled()) {
      // Belt and braces. getPaymentService() already refuses to hand this
      // out in production, and /dev/mock-payment 404s there.
      throw new Error("The mock payment service cannot be used in production.");
    }

    const url = new URL("/dev/mock-payment", "http://placeholder.invalid");
    url.searchParams.set("reference", input.reference);
    url.searchParams.set("amountKobo", String(input.amountKobo));
    url.searchParams.set("returnUrl", input.returnUrl);

    // Relative, so it works on localhost and over the LAN without caring
    // what host the buyer is on.
    return { redirectUrl: `${url.pathname}${url.search}` };
  },
};
