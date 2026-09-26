import "server-only";

import { env } from "@/lib/env";

/**
 * Cloudflare Turnstile — bot protection on the checkout (spec §7 step 1).
 *
 * Designed to be absent. With no keys configured the whole thing switches
 * off and the checkout works normally, so the site can be developed and
 * demonstrated without a Cloudflare account. Add the keys and it activates
 * with no code change.
 *
 * It fails CLOSED once enabled: if the key is set but Cloudflare cannot be
 * reached, the order is refused rather than waved through. A checkout that
 * silently stops checking bots the moment a third party has an outage is
 * not bot protection.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when both keys are present, which is the only way this runs. */
export function isTurnstileEnabled(): boolean {
  return Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  if (!isTurnstileEnabled()) return { ok: true };

  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY!,
    response: token,
  });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Cloudflare is normally fast. If it is not, the buyer should not sit
      // watching a spinner — fail and let them retry.
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { ok: false, reason: `verify-http-${response.status}` };
    }

    const result = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    return result.success
      ? { ok: true }
      : { ok: false, reason: result["error-codes"]?.join(",") || "rejected" };
  } catch (error) {
    console.error("[turnstile] verification failed", error);
    return { ok: false, reason: "verify-unreachable" };
  }
}
