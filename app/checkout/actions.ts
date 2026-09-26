"use server";

import { headers } from "next/headers";

import { checkRateLimit, clientIpFrom } from "@/lib/rateLimit";
import { getPublishedEvent } from "@/lib/services/events";
import { upsertAttendee } from "@/lib/services/attendees";
import { createPendingOrder, OrderCreationError } from "@/lib/services/orders";
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
      order: {
        reference: string;
        accessToken: string;
        totalKobo: number;
        expiresAt: string;
      };
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

  // ── 5. Attendee, then the order ─────────────────────────────────────────
  try {
    const attendeeId = await upsertAttendee(details);

    const order = await createPendingOrder({
      eventId: event.id,
      attendeeId,
      items,
    });

    return {
      ok: true,
      order: {
        reference: order.reference,
        accessToken: order.accessToken,
        totalKobo: order.totalKobo,
        expiresAt: order.expiresAt,
      },
    };

    // Phase 5 continues from here: call paymentService.startPayment() with
    // this order and redirect the buyer to the URL it returns. Nothing about
    // the code above needs to change for that.
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
