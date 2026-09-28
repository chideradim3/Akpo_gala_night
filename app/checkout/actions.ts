"use server";

import { headers } from "next/headers";

import { checkRateLimit, clientIpFrom } from "@/lib/rateLimit";
import { getPublishedEvent } from "@/lib/services/events";
import { upsertAttendee } from "@/lib/services/attendees";
import { createPendingOrder, OrderCreationError } from "@/lib/services/orders";
import { buildReturnUrl, getPaymentService, type PaymentService } from "@/lib/services/payment";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createOrderSchema, fieldErrors } from "@/lib/validation/checkout";

/**
 * The checkout's only write.
 *
 * Everything the browser sent is untrusted until it has been through
 * `createOrderSchema`. Note what the browser is never asked for and could
 * not supply if it tried: a price, a total, an event id. The event comes
 * from the database, the prices come from the database, and the total is
 * computed in Postgres inside the reservation transaction (rule 2).
 */

export type CreateOrderResult =
  | {
      ok: true;
      /** Where to send the buyer to pay. The client navigates here. */
      redirectUrl: string;
    }
  | {
      ok: false;
      /** Message for the top of the form. */
      message: string;
      /** Per-field messages, keyed as `details.email`, `items` and so on. */
      fields?: Record<string, string>;
      /**
       * Set when availability has moved under the buyer's feet, so the page
       * knows to refresh what it is offering rather than just apologising.
       */
      refreshAvailability?: boolean;
    };

export async function createOrderAction(rawInput: unknown): Promise<CreateOrderResult> {
  // ── 1. Rate limit ───────────────────────────────────────────────────────
  // Before any parsing or database work, so a flood costs us nothing.
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const limit = checkRateLimit(`order:${ip}`, { limit: 8, windowSeconds: 60 });

  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Please wait ${limit.retryAfterSeconds} seconds and try again.`,
    };
  }

  // ── 2. Validate ─────────────────────────────────────────────────────────
  const parsed = createOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the details below.",
      fields: fieldErrors(parsed.error),
    };
  }
  const { details, items, turnstileToken } = parsed.data;

  // ── 3. Bot check ────────────────────────────────────────────────────────
  // A no-op until Turnstile keys are configured.
  const turnstile = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstile.ok) {
    console.warn("[checkout] turnstile rejected", { ip, reason: turnstile.reason });
    return {
      ok: false,
      message: "We could not verify that you are human. Please refresh the page and try again.",
    };
  }

  // ── 4. The event ────────────────────────────────────────────────────────
  // Read here rather than accepted from the browser: the buyer does not get
  // to choose which event their order is attached to.
  const event = await getPublishedEvent();
  if (!event) {
    return { ok: false, message: "Tickets are not on sale at the moment." };
  }

  // ── 5. The payment provider, BEFORE anything is reserved ────────────────
  // Resolved here rather than after the order is created, because it can
  // refuse: the mock deliberately will not load in production, and `real`
  // fails if the integration has not been deployed.
  //
  // It used to be resolved further down, after createPendingOrder. That
  // meant every attempt in a misconfigured deployment reserved seats for a
  // payment that could never start, and held them for the full 30 minutes
  // until the expiry job swept them up. A buyer pressing the button five
  // times quietly locked five orders' worth of inventory, and the admin
  // order list filled with PENDING rows that had never been payable.
  let paymentService: PaymentService;
  try {
    paymentService = await getPaymentService();
  } catch (error) {
    // The detail names the variable to change; the buyer gets none of it.
    console.error("[checkout] no usable payment provider", error);
    return {
      ok: false,
      message:
        "Online payment is not available on this site yet. Nothing has been " +
        "reserved and you have not been charged.",
    };
  }

  // ── 6. Attendee, then the order ─────────────────────────────────────────
  try {
    const attendeeId = await upsertAttendee(details);

    const order = await createPendingOrder({
      eventId: event.id,
      attendeeId,
      items,
    });

    // ── 7. Hand off to the payment provider ────────────────────────────
    // The order exists and its seats are held. Everything from here is the
    // payment developer's side of the boundary; we only need a URL.
    let redirectUrl: string;
    try {
      const started = await paymentService.startPayment({
        orderId: order.orderId,
        reference: order.reference,
        amountKobo: order.totalKobo,
        currency: "NGN",
        customer: {
          email: details.email,
          firstName: details.firstName,
          lastName: details.lastName,
          phone: details.phone,
        },
        returnUrl: buildReturnUrl(order.reference, order.accessToken),
      });
      redirectUrl = started.redirectUrl;
    } catch (paymentError) {
      // The order stays PENDING and expires on its own in 30 minutes,
      // releasing the seats. Nothing to unwind by hand.
      console.error("[checkout] startPayment failed", {
        reference: order.reference,
        error: paymentError,
      });
      return {
        ok: false,
        message:
          "We could not reach the payment provider. Your seats are held for 30 minutes — " +
          "please try again shortly.",
      };
    }

    return { ok: true, redirectUrl };
  } catch (error) {
    if (error instanceof OrderCreationError) {
      return {
        ok: false,
        message: error.message,
        // Sold out, tier withdrawn, or sale window closed: in all three the
        // page is showing something that is no longer true.
        refreshAvailability: ["GN001", "GN003", "GN004"].includes(error.code),
      };
    }

    console.error("[checkout] unexpected failure", error);
    return {
      ok: false,
      message: "Something went wrong on our side. Please try again in a moment.",
    };
  }
}
