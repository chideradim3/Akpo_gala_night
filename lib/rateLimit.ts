import "server-only";

/**
 * Rate limiting for order creation, find-tickets and the payment confirm
 * route (spec §11).
 *
 * ── A HONEST LIMITATION ──────────────────────────────────────────────────
 * This counter lives in the memory of one server process. On Vercel that
 * means each serverless instance keeps its own tally, so someone determined
 * gets a few more attempts than the number below suggests, and the counts
 * reset whenever an instance is recycled.
 *
 * That is a deliberate trade for now. It stops the accidental double-click
 * and the casual script, which is what actually happens, without adding a
 * Redis dependency and another service to pay for and keep running.
 *
 * Phase 9 revisits this. If it needs to become real, the swap is Upstash
 * Redis behind this same `checkRateLimit` signature — no caller changes.
 * ─────────────────────────────────────────────────────────────────────────
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stop the map growing without bound on a long-lived process. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfterSeconds: number;
};

/**
 * Allow `limit` attempts per `windowSeconds` for a given key.
 *
 * The key should identify the actor as precisely as you can — usually
 * `"order:" + ip`, or the email for something like find-tickets, so one
 * person on a shared office IP cannot lock out their colleagues.
 */
export function checkRateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP from the proxy headers Vercel sets.
 *
 * Falls back to a constant, which means everyone shares one bucket when the
 * header is missing. That fails CLOSED — stricter than intended rather than
 * looser — which is the right direction for a limiter to be wrong in.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // First entry is the original client; the rest are proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
