import { NextResponse } from "next/server";

import { requirePaymentConfirmSecret } from "@/lib/env";
import { checkRateLimit, clientIpFrom } from "@/lib/rateLimit";
import { SIGNATURE_HEADER, verifySignature } from "@/lib/services/payment/signature";
import { confirmOrderPayment, PaymentConfirmationError } from "@/lib/services/orders";
import { confirmPaymentSchema } from "@/lib/validation/payment";

/**
 * POST /api/payments/confirm
 *
 * The single door through which an order can become PAID. Called by the
 * payment developer's system, never by a browser.
 *
 * See PAYMENT_INTEGRATION.md for the contract. In short:
 *   - `X-Signature`: HMAC-SHA256 of the raw body, hex, using
 *     PAYMENT_CONFIRM_SECRET
 *   - idempotent on `paymentReference`
 *   - amount must match the order total exactly
 *
 * Responses are deliberately terse. This is a machine-to-machine endpoint,
 * and a detailed error tells an attacker probing it what to change next.
 * The full reason is always in the server log.
 */

// A webhook is never cached or prerendered.
export const dynamic = "force-dynamic";

function reject(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  // ── Rate limit ──────────────────────────────────────────────────────────
  // Generous: a provider legitimately retries, and several buyers can pay at
  // the same moment. This is here to blunt someone hammering the endpoint
  // with forged signatures, not to police normal traffic.
  const ip = clientIpFrom(request.headers);
  const limit = checkRateLimit(`confirm:${ip}`, { limit: 60, windowSeconds: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let secret: string;
  try {
    secret = requirePaymentConfirmSecret();
  } catch (error) {
    // Misconfiguration on our side, not a bad request. 500 so the provider
    // retries once we have fixed it, rather than treating it as rejected.
    console.error("[payments/confirm] not configured", error);
    return reject(500, "Not configured");
  }

  // ── Signature, over the RAW body ────────────────────────────────────────
  // Read as text and verify before parsing. Re-serialising JSON can reorder
  // keys or change whitespace, and the signature would then never match.
  const rawBody = await request.text();

  if (!verifySignature(rawBody, secret, request.headers.get(SIGNATURE_HEADER))) {
    console.warn("[payments/confirm] invalid signature", { ip, bytes: rawBody.length });
    return reject(401, "Invalid signature");
  }

  // ── Parse and validate ──────────────────────────────────────────────────
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return reject(400, "Body is not valid JSON");
  }

  const parsed = confirmPaymentSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.warn("[payments/confirm] invalid payload", parsed.error.issues);
    return reject(400, "Invalid payload");
  }

  // ── Confirm ─────────────────────────────────────────────────────────────
  try {
    const result = await confirmOrderPayment(parsed.data);

    console.info("[payments/confirm]", {
      reference: parsed.data.reference,
      outcome: result.outcome,
      ticketsIssued: result.ticketsIssued,
    });

    // Phase 6 hooks in here: email the tickets after the transaction has
    // committed. Deliberately after, and deliberately not awaited into the
    // transaction — a failing mail server must never undo a real payment.

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      ticketsIssued: result.ticketsIssued,
    });
  } catch (error) {
    if (error instanceof PaymentConfirmationError) {
      // 404 for an unknown order so the caller can tell "wrong reference"
      // from "right reference, wrong amount". 409 for everything else:
      // the request was well formed but conflicts with the order's state,
      // and retrying it unchanged will not help.
      const status = error.code === "GN101" ? 404 : 409;
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status },
      );
    }

    console.error("[payments/confirm] unexpected failure", error);
    // 500 invites a retry, which is right: we do not know whether the
    // payment was recorded, and the idempotency check makes retrying safe.
    return reject(500, "Internal error");
  }
}
