import "server-only";

import QRCode from "qrcode";

/**
 * QR codes for tickets.
 *
 * WHAT GOES IN THE CODE: the ticket's `qr_token` and nothing else.
 *
 * Not the guest's name, not their email, not the order reference. A ticket
 * gets photographed, forwarded on WhatsApp and left face-up on a table, and
 * whatever is encoded travels with it. The token is an opaque 32-byte random
 * string that means nothing without our database, so a leaked screenshot
 * leaks no personal data.
 *
 * Rendered as SVG on the ticket page: it is a fraction of the size of a PNG,
 * stays sharp when someone zooms in at the door, and needs no image request.
 * Phase 6's email uses the data-URL form instead, because email clients will
 * not render inline SVG.
 */

/** Error correction M tolerates ~15% damage — fine for a phone screen. */
const OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  color: { dark: "#000000", light: "#ffffff" },
};

/** Inline SVG markup for a ticket page. */
export async function qrSvg(qrToken: string): Promise<string> {
  return QRCode.toString(qrToken, { ...OPTIONS, type: "svg", width: 320 });
}

/** `data:image/png;base64,…` for emails and downloads. */
export async function qrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, { ...OPTIONS, width: 512 });
}
