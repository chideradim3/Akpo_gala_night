import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EmailSender, OutgoingEmail, SendResult } from "@/lib/services/notifications";

/**
 * The default driver: nothing is sent anywhere.
 *
 * It logs a summary and writes the rendered email to `.mail/` so you can
 * open it in a browser and see exactly what a buyer would get — including
 * the QR images, which are rewritten from `cid:` references to inline data
 * URIs so they display in a normal browser.
 *
 * This means the whole ticket flow can be built and demonstrated without a
 * Resend account, a verified domain, or the risk of emailing a real person
 * during testing.
 */

const OUTBOX = ".mail";

/** Swap `cid:` references for data URIs so a browser can render the preview. */
function inlineAttachments(email: OutgoingEmail): string {
  let html = email.html;
  for (const attachment of email.attachments ?? []) {
    if (!attachment.contentId) continue;
    const dataUri = `data:${attachment.contentType ?? "image/png"};base64,${attachment.content}`;
    html = html.split(`cid:${attachment.contentId}`).join(dataUri);
  }
  return html;
}

export const consoleSender: EmailSender = {
  name: "console",

  async send(email: OutgoingEmail): Promise<SendResult> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTo = email.to.replace(/[^a-z0-9]+/gi, "_");
    const filename = `${stamp}__${safeTo}.html`;

    try {
      await mkdir(OUTBOX, { recursive: true });
      await writeFile(join(OUTBOX, filename), inlineAttachments(email), "utf8");
    } catch (error) {
      // Writing the preview is a convenience, not the job. Still report
      // success so a read-only filesystem does not look like a mail failure.
      console.warn("[email:console] could not write the preview file", error);
    }

    console.info(
      [
        "",
        "┌─────────────────────────────────────────────────────────────",
        "│ EMAIL (not sent — EMAIL_PROVIDER=console)",
        `│ To:      ${email.to}`,
        `│ Subject: ${email.subject}`,
        `│ Files:   ${email.attachments?.length ?? 0} attachment(s)`,
        `│ Preview: ${join(OUTBOX, filename)}`,
        "└─────────────────────────────────────────────────────────────",
        email.text,
        "",
      ].join("\n"),
    );

    return { ok: true, id: filename };
  },
};
