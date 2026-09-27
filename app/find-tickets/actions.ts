"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { checkRateLimit, clientIpFrom } from "@/lib/rateLimit";
import { resendTicketsForEmail } from "@/lib/services/ticketDelivery";

/**
 * Lost-ticket recovery (spec §7).
 *
 * ── THE SAME ANSWER, ALWAYS ──────────────────────────────────────────────
 * Whatever happens — tickets found and sent, no such buyer, rate limited,
 * mail server down — the visitor is told the same thing.
 *
 * That is not vagueness for its own sake. A form that says "no tickets for
 * that address" is an oracle: anyone can feed it a list of email addresses
 * and learn which of them are coming to your event. Guest lists are worth
 * money, and for some guests being known to attend is itself sensitive.
 *
 * It also means the honest outcomes and the hostile ones are
 * indistinguishable from outside, which is the point.
 * ─────────────────────────────────────────────────────────────────────────
 */

const NEUTRAL_MESSAGE =
  "If we found tickets for that email address, we have sent them. Please check your inbox, and your spam folder.";

const schema = z.object({
  email: z.string().trim().min(1).max(254).pipe(z.email()),
});

export type FindTicketsResult = { message: string; invalid?: boolean };

export async function findTicketsAction(rawEmail: unknown): Promise<FindTicketsResult> {
  // A malformed address is the one case worth saying out loud: it tells the
  // visitor to fix a typo and reveals nothing, because no lookup happened.
  const parsed = schema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return { message: "Enter a valid email address.", invalid: true };
  }
  const email = parsed.data.email.toLowerCase();

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  // Two limits. The per-IP one stops someone working through a list of
  // addresses; the per-address one stops anyone being used to flood a
  // particular person's inbox, even from many IPs.
  const byIp = checkRateLimit(`find:ip:${ip}`, { limit: 5, windowSeconds: 600 });
  const byEmail = checkRateLimit(`find:email:${email}`, { limit: 3, windowSeconds: 900 });

  if (!byIp.allowed || !byEmail.allowed) {
    console.warn("[find-tickets] rate limited", { ip, limited: !byIp.allowed ? "ip" : "email" });
    // Still the neutral message: saying "too many attempts" would confirm
    // the attempts were reaching something.
    return { message: NEUTRAL_MESSAGE };
  }

  try {
    const sent = await resendTicketsForEmail(email);
    console.info("[find-tickets] processed", { ip, sent });
  } catch (error) {
    // Logged, never surfaced. The visitor gets the same sentence.
    console.error("[find-tickets] failed", error);
  }

  return { message: NEUTRAL_MESSAGE };
}
