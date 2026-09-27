import { NextResponse } from "next/server";

import { checkRateLimit, clientIpFrom } from "@/lib/rateLimit";
import { getOrderStatus } from "@/lib/services/orders";

/**
 * GET /api/orders/status?ref=GALA-1042&token=…
 *
 * READ ONLY. The payment return page polls this while it waits.
 *
 * It cannot change anything — there is no write path in this file, and
 * marking an order paid is possible only through the signed confirm route
 * (spec §3 rules 5 and 6). Polling it a thousand times has no effect beyond
 * the rate limit.
 *
 * Requires BOTH the reference and the access token. The reference is short
 * and guessable; the token is 32 random bytes and is what actually
 * authorises the read.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = clientIpFrom(request.headers);
  // The page polls every 3 seconds, so this allows a couple of minutes of
  // honest waiting while still capping a script.
  const limit = checkRateLimit(`status:${ip}`, { limit: 60, windowSeconds: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get("ref");
  const token = url.searchParams.get("token");

  if (!reference || !token) {
    return NextResponse.json({ error: "Missing reference or token" }, { status: 400 });
  }

  const order = await getOrderStatus(reference, token);

  // Same response for "no such order" and "wrong token", so this cannot be
  // used to discover which references exist.
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: order.status,
    reference: order.reference,
    totalKobo: order.total_kobo,
    paidAt: order.paid_at,
    expiresAt: order.expires_at,
  });
}
