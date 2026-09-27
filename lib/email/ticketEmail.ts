import "server-only";

import { formatEventDate, formatEventTimeRange, formatVenue } from "@/lib/formatEvent";
import { formatNaira, type Kobo } from "@/lib/money";
import type { GalaEvent } from "@/lib/services/events";
import type { EmailAttachment, OutgoingEmail } from "@/lib/services/notifications";

/**
 * The ticket email.
 *
 * WRITTEN FOR EMAIL CLIENTS, NOT BROWSERS. The rules are twenty years old
 * and still apply:
 *
 *  - Tables for layout. Outlook uses Word to render HTML and ignores most
 *    modern CSS, including flex and grid.
 *  - Every style inline. Gmail strips <style> blocks in several contexts.
 *  - No external CSS, no webfonts, no SVG. Georgia is used for headings
 *    because it is installed everywhere and is the closest common face to
 *    the site's Didone.
 *  - QR codes as `cid:` inline attachments. Gmail silently drops data: URIs
 *    in <img>, which would leave a large share of buyers with no QR at all.
 *
 * And the rule that matters most: THE EMAIL MUST STILL WORK WITH NO IMAGES.
 * Many clients block them by default. So each ticket shows its code in large
 * text, and there is a prominent link to the ticket page. A guest whose
 * images never loaded can still get through the door.
 */

export type TicketForEmail = {
  ticketCode: string;
  tierName: string;
  admits: number;
  /** PNG data URL from qrDataUrl(). Split into a cid attachment below. */
  qrDataUrl: string;
};

const INK = "#ffffff";
const INK_SOFT = "#b9b6c2";
const INK_MUTED = "#86828f";
const PAGE = "#08070a";
const CARD = "#141319";
const LINE = "#2a2831";
const ACCENT = "#c084fc";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pull the base64 out of a data URL so it can be sent as an attachment. */
function splitDataUrl(dataUrl: string): { contentType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { contentType: "image/png", base64: "" };
  return { contentType: match[1], base64: match[2] };
}

function ticketBlock(ticket: TicketForEmail, index: number): string {
  const cid = `qr${index}`;
  return `
  <tr>
    <td style="padding:0 0 16px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${CARD};border:1px solid ${LINE};border-radius:14px;">
        <tr>
          <td style="padding:22px 22px 6px 22px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${INK_MUTED};">
              ${escapeHtml(ticket.tierName)}
            </p>
            <p style="margin:8px 0 0 0;font-size:14px;color:${ACCENT};">
              ${ticket.admits === 1 ? "Admits one guest" : `Admits ${ticket.admits} guests`}
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 22px 6px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                   style="background:#ffffff;border-radius:12px;">
              <tr>
                <td style="padding:12px;line-height:0;">
                  <img src="cid:${cid}" width="200" height="200" alt="QR code for ticket ${escapeHtml(ticket.ticketCode)}"
                       style="display:block;width:200px;height:200px;border:0;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:10px 22px 24px 22px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${INK_MUTED};">
              Ticket code
            </p>
            <p style="margin:6px 0 0 0;font-size:24px;letter-spacing:3px;font-weight:bold;color:${INK};">
              ${escapeHtml(ticket.ticketCode)}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function buildTicketEmail(input: {
  event: GalaEvent | null;
  guestName: string;
  to: string;
  reference: string;
  totalKobo: Kobo;
  ticketsUrl: string;
  tickets: TicketForEmail[];
  /** True when the buyer asked for these again rather than just buying. */
  isResend?: boolean;
}): OutgoingEmail {
  const eventName = input.event?.name ?? "Gala Night";
  const when = input.event ? formatEventDate(input.event.date) : null;
  const time = input.event ? formatEventTimeRange(input.event) : null;
  const where = input.event ? formatVenue(input.event) : null;

  const details = [when, time, where].filter(Boolean) as string[];

  const attachments: EmailAttachment[] = input.tickets.map((ticket, index) => {
    const { contentType, base64 } = splitDataUrl(ticket.qrDataUrl);
    return {
      filename: `ticket-${ticket.ticketCode}.png`,
      content: base64,
      contentId: `qr${index}`,
      contentType,
    };
  });

  const ticketCount = input.tickets.length;
  const subject = input.isResend
    ? `Your tickets for ${eventName}`
    : `You're going to ${eventName} — ${ticketCount} ticket${ticketCount === 1 ? "" : "s"}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <!-- Shown in the inbox list next to the subject, then hidden. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(`${ticketCount} ticket${ticketCount === 1 ? "" : "s"} · ${input.reference} · screenshot these before you travel`)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;width:100%;">

          <tr>
            <td align="center" style="padding:10px 0 26px 0;font-family:Georgia,'Times New Roman',serif;">
              <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT};">
                ${input.isResend ? "Your tickets" : "You're going"}
              </p>
              <h1 style="margin:0;font-size:32px;line-height:1.2;color:${INK};font-weight:normal;">
                ${escapeHtml(eventName)}
              </h1>
              ${
                details.length
                  ? `<p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${INK_SOFT};">
                       ${escapeHtml(details.join(" · "))}
                     </p>`
                  : ""
              }
            </td>
          </tr>

          <tr>
            <td style="padding:0 0 22px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${INK_SOFT};">
              <p style="margin:0;">Hello ${escapeHtml(input.guestName)},</p>
              <p style="margin:12px 0 0 0;">
                ${
                  input.isResend
                    ? "Here are your tickets again, as requested."
                    : `Your payment is confirmed and your ${ticketCount === 1 ? "ticket is" : "tickets are"} below.`
                }
                <strong style="color:${INK};">Take a screenshot of each code now</strong> — you will not
                need signal at the door.
              </p>
            </td>
          </tr>

          ${input.tickets.map(ticketBlock).join("")}

          <tr>
            <td align="center" style="padding:8px 0 26px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#ffffff;border-radius:999px;">
                    <a href="${escapeHtml(input.ticketsUrl)}"
                       style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#08070a;text-decoration:none;">
                      View your tickets
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${INK_MUTED};">
                Keep this link private — anyone who has it can see these tickets.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 0 0 0;border-top:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${INK_MUTED};">
              <p style="margin:0;">Order ${escapeHtml(input.reference)} · ${escapeHtml(formatNaira(input.totalKobo))}</p>
              ${
                input.event?.contactEmail
                  ? `<p style="margin:6px 0 0 0;">Questions? <a href="mailto:${escapeHtml(input.event.contactEmail)}" style="color:${ACCENT};">${escapeHtml(input.event.contactEmail)}</a></p>`
                  : ""
              }
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // The plain-text version is not a formality: it is what shows when images
  // and HTML are blocked, and it must be enough to get someone in.
  const text = [
    input.isResend ? "YOUR TICKETS" : "YOU'RE GOING",
    eventName.toUpperCase(),
    details.length ? details.join(" · ") : "",
    "",
    `Hello ${input.guestName},`,
    "",
    input.isResend
      ? "Here are your tickets again, as requested."
      : `Your payment is confirmed. ${ticketCount === 1 ? "Your ticket is" : `Your ${ticketCount} tickets are`} below.`,
    "",
    "TICKET CODES — show these at the door:",
    ...input.tickets.map(
      (ticket) =>
        `  ${ticket.ticketCode}   ${ticket.tierName}, admits ${ticket.admits}`,
    ),
    "",
    `View your tickets (with QR codes): ${input.ticketsUrl}`,
    "",
    "Take a screenshot before you travel — you will not need signal at the door.",
    "Keep the link private; anyone who has it can see these tickets.",
    "",
    `Order ${input.reference} · ${formatNaira(input.totalKobo)}`,
    input.event?.contactEmail ? `Questions? ${input.event.contactEmail}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { to: input.to, subject, html, text, attachments };
}
