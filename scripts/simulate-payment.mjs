/**
 * Send a correctly signed payment confirmation, without a payment provider.
 *
 *   npm run simulate-payment -- --ref GALA-1042 --amount 21500000
 *   npm run simulate-payment -- --ref GALA-1042 --amount 500000 --status failed
 *   npm run simulate-payment -- --ref GALA-1042 --amount 500000 --payment-ref PSP-1
 *
 * Options
 *   --ref          the order reference (required)
 *   --amount       amount in KOBO, must match the order total exactly (required)
 *   --status       success | failed                      (default: success)
 *   --payment-ref  the provider's reference              (default: a new one)
 *   --url          base URL of the site                  (default: NEXT_PUBLIC_SITE_URL)
 *
 * WHY THIS EXISTS
 *
 * It is the same request the payment developer's system will make: same
 * route, same HMAC signature, same payload. So it tests the real path rather
 * than a shortcut around it.
 *
 * It is also the only convenient way to test IDEMPOTENCY. Pass the same
 * --payment-ref twice: the first call pays the order and issues tickets, the
 * second must report ALREADY_PROCESSED and issue nothing further. A provider
 * that retries a webhook it thinks failed does exactly this, and getting it
 * wrong means two sets of tickets for one payment.
 */

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const values = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    values[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return values;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith("--") ? (i += 1, next) : "true";
  }
  return args;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const env = loadEnvLocal();

const reference = args.ref;
const amountKobo = Number(args.amount);
const status = args.status ?? "success";
const paymentReference =
  args["payment-ref"] ?? `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const baseUrl = args.url ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const secret = env.PAYMENT_CONFIRM_SECRET;

if (!reference) fail("Missing --ref. Example:  npm run simulate-payment -- --ref GALA-1042 --amount 500000");
if (!Number.isInteger(amountKobo) || amountKobo < 0) {
  fail(
    "Missing or invalid --amount. It must be an INTEGER NUMBER OF KOBO.\n" +
      "  ₦5,000 is 500000, not 5000.",
  );
}
if (!["success", "failed"].includes(status)) fail("--status must be 'success' or 'failed'");
if (!secret) {
  fail(
    "PAYMENT_CONFIRM_SECRET is not set in .env.local.\n" +
      '  Generate one:  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

const body = JSON.stringify({
  reference,
  paymentReference,
  amountKobo,
  status,
  paidAt: new Date().toISOString(),
  raw: { simulated: true, source: "scripts/simulate-payment.mjs" },
});

// The signature is over the RAW body string, exactly as sent.
const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

console.log(`\nPOST ${baseUrl}/api/payments/confirm`);
console.log(`  reference        ${reference}`);
console.log(`  paymentReference ${paymentReference}`);
console.log(`  amountKobo       ${amountKobo}  (₦${(amountKobo / 100).toLocaleString("en-NG")})`);
console.log(`  status           ${status}\n`);

try {
  const response = await fetch(`${baseUrl}/api/payments/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body,
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  console.log(`HTTP ${response.status}`);
  console.log(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));

  if (response.ok && parsed?.outcome === "ALREADY_PROCESSED") {
    console.log("\nIdempotency held: nothing changed, no extra tickets issued.");
  }

  process.exit(response.ok ? 0 : 1);
} catch (error) {
  fail(
    `Could not reach ${baseUrl}/api/payments/confirm\n` +
      `  ${error.message}\n\n  Is the dev server running?`,
  );
}
