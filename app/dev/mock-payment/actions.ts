"use server";

import { requirePaymentConfirmSecret, siteUrl } from "@/lib/env";
import { SIGNATURE_HEADER, signPayload } from "@/lib/services/payment/signature";
import { devRoutesEnabled } from "@/lib/utils";

/**
 * DEVELOPMENT ONLY. Delete with the rest of the mock.
 *
 * Simulates what the payment developer's system will do: build a
 * confirmation payload, sign it with PAYMENT_CONFIRM_SECRET, and POST it to
 * the real /api/payments/confirm route over HTTP.
 *
 * It deliberately goes through the actual HTTP endpoint rather than calling
 * confirmOrderPayment() directly. Calling the service would skip the
 * signature check, the schema and the route's error handling — the parts
 * most likely to be wrong in production. This way the mock proves the real
 * path works.
 */
export async function simulatePaymentAction(input: {
  reference: string;
  amountKobo: number;
  outcome: "success" | "failed";
}): Promise<{ ok: boolean; message: string }> {
  if (!devRoutesEnabled()) {
    return { ok: false, message: "Not available." };
  }

  let secret: string;
  try {
    secret = requirePaymentConfirmSecret();
  } catch {
    return {
      ok: false,
      message:
        "PAYMENT_CONFIRM_SECRET is not set in .env.local. Generate one with:  " +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    };
  }

  const body = JSON.stringify({
    reference: input.reference,
    // A fresh reference each time, so pressing the button twice looks like
    // two different payments rather than a retry. To exercise idempotency,
    // use scripts/simulate-payment.ts, which lets you reuse one.
    paymentReference: `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amountKobo: input.amountKobo,
    status: input.outcome,
    paidAt: new Date().toISOString(),
    raw: { simulated: true, source: "dev/mock-payment" },
  });

  try {
    const response = await fetch(new URL("/api/payments/confirm", siteUrl()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The exact header the real integration must send.
        [SIGNATURE_HEADER]: signPayload(body, secret),
      },
      body,
    });

    const result = (await response.json()) as {
      ok?: boolean;
      outcome?: string;
      ticketsIssued?: number;
      error?: string;
    };

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        message: `The confirm route refused it: ${response.status} ${result.error ?? ""}`.trim(),
      };
    }

    return {
      ok: true,
      message:
        result.outcome === "PAID"
          ? `Paid. ${result.ticketsIssued} ticket(s) issued.`
          : `Recorded: ${result.outcome}`,
    };
  } catch (error) {
    console.error("[dev/mock-payment] request failed", error);
    return {
      ok: false,
      message:
        "Could not reach /api/payments/confirm. Check NEXT_PUBLIC_SITE_URL in .env.local " +
        "matches the address you are browsing on.",
    };
  }
}
