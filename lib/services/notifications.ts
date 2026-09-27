import "server-only";

import { env } from "@/lib/env";

/**
 * Sending email.
 *
 * One interface, two drivers. The rest of the app calls `sendEmail()` and
 * never knows or cares which is in use, so changing provider later is one
 * new file and one environment variable.
 *
 *   EMAIL_PROVIDER=console   writes the email to disk and logs it (default)
 *   EMAIL_PROVIDER=resend    actually sends it
 *
 * Email only. There is no SMS in this system and no place to add one
 * (spec §9).
 */

export type EmailAttachment = {
  filename: string;
  /** Base64, no data: prefix. */
  content: string;
  /**
   * Set to reference the file from the HTML as <img src="cid:thatId">.
   *
   * Inline attachments, not data: URIs. Gmail silently drops data: images,
   * so a QR embedded that way would be invisible to a large share of
   * Nigerian buyers — which for a ticket is the whole point of the email.
   */
  contentId?: string;
  contentType?: string;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  /** Always provide one. Some clients show it, and spam filters read it. */
  text: string;
  attachments?: EmailAttachment[];
};

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export interface EmailSender {
  readonly name: string;
  send(email: OutgoingEmail): Promise<SendResult>;
}

/** The From address. Must be on a domain verified with the provider. */
export function emailFrom(): string {
  return env.EMAIL_FROM ?? "Gala Night <tickets@example.com>";
}

export async function getEmailSender(): Promise<EmailSender> {
  if (env.EMAIL_PROVIDER === "resend") {
    const { resendSender } = await import("./email/resend");
    return resendSender;
  }
  const { consoleSender } = await import("./email/console");
  return consoleSender;
}

/**
 * Send one email.
 *
 * Never throws. Delivery failure must not take down whatever triggered it —
 * in particular, a mail outage must never roll back a payment that actually
 * succeeded. Callers get `{ ok: false }` and decide what to do.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  try {
    const sender = await getEmailSender();
    const result = await sender.send(email);

    if (!result.ok) {
      console.error("[email] send failed", { to: email.to, via: sender.name, error: result.error });
    } else {
      console.info("[email] sent", { to: email.to, via: sender.name, subject: email.subject });
    }

    return result;
  } catch (error) {
    console.error("[email] sender threw", error);
    return { ok: false, error: error instanceof Error ? error.message : "unknown error" };
  }
}
