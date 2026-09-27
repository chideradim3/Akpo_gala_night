import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The signature on POST /api/payments/confirm.
 *
 * HMAC-SHA256 of the RAW request body, hex encoded, sent as `X-Signature`.
 *
 * It must be the raw body, byte for byte — not a re-serialised object.
 * `JSON.stringify(JSON.parse(body))` can reorder keys or change spacing, and
 * then a perfectly valid signature fails. The route reads `await
 * request.text()` and verifies that exact string before parsing it.
 */

export const SIGNATURE_HEADER = "x-signature";

export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Constant-time comparison.
 *
 * A plain `===` on a signature leaks information: it returns faster the
 * earlier the first difference is, which over many attempts lets someone
 * work out the expected value one character at a time. Rare in practice,
 * free to avoid.
 */
export function verifySignature(rawBody: string, secret: string, provided: string | null): boolean {
  if (!provided) return false;

  const expected = signPayload(rawBody, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided.trim(), "utf8");

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal. Compare lengths first and return the same way either way.
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
