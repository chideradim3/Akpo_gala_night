import "server-only";

import { env, siteUrl } from "@/lib/env";

/**
 * The payment boundary.
 *
 * Everything the payment provider touches lives behind this one interface
 * and the `/api/payments/confirm` route. The checkout knows nothing about
 * Providus, Paystack or anyone else — it calls `startPayment` and redirects
 * to whatever URL comes back.
 *
 * FOR THE PAYMENT DEVELOPER: implement `PaymentService` in `./real.ts` and
 * set `PAYMENT_PROVIDER=real`. Nothing else in this repository needs to
 * change. See PAYMENT_INTEGRATION.md.
 */

export interface PaymentService {
  startPayment(input: {
    orderId: string;
    /** Our human-readable reference, e.g. GALA-1042. */
    reference: string;
    /** INTEGER KOBO. ₦5,000 is 500000. Never a float. */
    amountKobo: number;
    currency: "NGN";
    customer: {
      email: string;
      firstName: string;
      lastName: string;
      /** Always +234XXXXXXXXXX. */
      phone: string;
    };
    /** Where to send the buyer afterwards, whatever the outcome. */
    returnUrl: string;
  }): Promise<{ redirectUrl: string }>;
}

/**
 * Build the URL the provider returns the buyer to.
 *
 * Carries the reference and the access token, because the return page has
 * to identify the order without a session — the buyer may come back in a
 * different browser from the one they started in.
 */
export function buildReturnUrl(reference: string, accessToken: string): string {
  const url = new URL("/payment/return", siteUrl());
  url.searchParams.set("ref", reference);
  url.searchParams.set("token", accessToken);
  return url.toString();
}

/**
 * Pick the implementation from one environment variable.
 *
 * The mock is imported lazily and only when selected, so the real deployment
 * never loads it — and the payment developer can delete those files without
 * touching this one.
 */
export async function getPaymentService(): Promise<PaymentService> {
  if (env.PAYMENT_PROVIDER === "real") {
    try {
      const module_ = (await import("./real")) as { realPaymentService: PaymentService };
      return module_.realPaymentService;
    } catch {
      throw new Error(
        "PAYMENT_PROVIDER=real but lib/services/payment/real.ts is missing or does not " +
          "export `realPaymentService`. See PAYMENT_INTEGRATION.md.",
      );
    }
  }

  if (env.NODE_ENV === "production") {
    // The mock refuses to load in production anyway; this is the clearer
    // error, raised before a buyer is sent anywhere.
    throw new Error(
      "PAYMENT_PROVIDER is 'mock' in production. Set PAYMENT_PROVIDER=real and deploy " +
        "the real payment integration before taking money.",
    );
  }

  const { devMockPaymentService } = await import("./mock");
  return devMockPaymentService;
}
