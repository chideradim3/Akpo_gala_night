import "server-only";

import { env } from "@/lib/env";
import {
  emailFrom,
  type EmailSender,
  type OutgoingEmail,
  type SendResult,
} from "@/lib/services/notifications";

/**
 * Resend, over its REST API.
 *
 * Deliberately plain `fetch` rather than the `resend` npm package: the call
 * is one POST, and the spec asks for few dependencies. Swapping to another
 * provider means writing a sibling of this file, not touching anything that
 * calls it.
 *
 * Before this works you need, in Resend: an API key, and a domain you have
 * verified. `EMAIL_FROM` must be an address on that domain — sending as
 * gmail.com or similar is rejected, and that is the commonest first failure.
 */

const ENDPOINT = "https://api.resend.com/emails";

export const resendSender: EmailSender = {
  name: "resend",

  async send(email: OutgoingEmail): Promise<SendResult> {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: "RESEND_API_KEY is not set, but EMAIL_PROVIDER=resend",
      };
    }

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom(),
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          attachments: email.attachments?.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            // Resend uses snake_case here. With it set, the file is inlined
            // and referenced by <img src="cid:…">; without it, the QR
            // arrives as a download rather than a picture.
            content_id: attachment.contentId,
            content_type: attachment.contentType,
          })),
        }),
        // A slow mail API must not hold a payment confirmation open.
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return { ok: false, error: `Resend returned ${response.status} ${detail}`.trim() };
      }

      const result = (await response.json()) as { id?: string };
      return { ok: true, id: result.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "request failed",
      };
    }
  },
};
