/**
 * Check that email sending actually works.
 *
 *   npm run test-email -- --to you@example.com
 *
 * Sends a real message through whichever provider .env.local selects, so it
 * proves the API key, the verified domain and the From address all line up
 * — without needing to make a fake purchase each time you change something.
 *
 * It deliberately does NOT go through the app. Fewer moving parts means
 * that when it fails, the failure is the email configuration and nothing
 * else.
 */

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
    values[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  if (!process.argv[i].startsWith("--")) continue;
  const key = process.argv[i].slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args[key] = next;
    i += 1;
  } else {
    args[key] = "true";
  }
}

const env = loadEnvLocal();
const to = args.to;

if (!to || !to.includes("@")) {
  console.error("\nMissing --to.\n  npm run test-email -- --to you@example.com\n");
  process.exit(1);
}

const provider = env.EMAIL_PROVIDER || "console";
const from = env.EMAIL_FROM || "";
const apiKey = env.RESEND_API_KEY || "";

console.log("");
console.log(`  EMAIL_PROVIDER  ${provider}`);
console.log(`  EMAIL_FROM      ${from || "(not set)"}`);
console.log(`  RESEND_API_KEY  ${apiKey ? `set, ${apiKey.length} chars` : "(not set)"}`);
console.log("");

if (provider === "console") {
  console.log("  EMAIL_PROVIDER is 'console', so nothing is sent anywhere.");
  console.log("  Emails are written to the .mail/ folder instead — open one in a browser.");
  console.log("");
  console.log("  To send for real, set in .env.local:");
  console.log("    EMAIL_PROVIDER=resend");
  console.log("    RESEND_API_KEY=re_...");
  console.log("    EMAIL_FROM=Your Event <tickets@yourdomain.com>");
  console.log("");
  process.exit(0);
}

if (!apiKey) {
  console.error("  RESEND_API_KEY is empty but EMAIL_PROVIDER=resend. Nothing can be sent.\n");
  process.exit(1);
}
if (!from) {
  console.error("  EMAIL_FROM is empty. It must be an address on your verified domain.\n");
  process.exit(1);
}

// The commonest first failure, worth catching before the API does.
const domain = from.match(/<([^>]+)>/)?.[1]?.split("@")[1] ?? from.split("@")[1];
if (domain && /(gmail|yahoo|outlook|hotmail|icloud)\./i.test(domain)) {
  console.error(`  EMAIL_FROM uses ${domain}, which providers will reject.`);
  console.error("  It must be an address on a domain you have verified in Resend.\n");
  process.exit(1);
}

const body = {
  from,
  to: [to],
  subject: "Email is working",
  text:
    "If you are reading this, ticket emails will reach your buyers.\n\n" +
    "Sent by: npm run test-email\n",
  html:
    '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
    "<h2>Email is working</h2>" +
    "<p>If you are reading this, ticket emails will reach your buyers.</p>" +
    '<p style="color:#666;font-size:13px">Sent by <code>npm run test-email</code></p>' +
    "</div>",
};

console.log(`  Sending to ${to}…`);

try {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`\n  FAILED — Resend returned ${response.status}`);
    console.error(`  ${text}\n`);

    if (response.status === 401) {
      console.error("  A 401 means the API key is wrong or has been revoked.");
    }
    if (/domain is not verified|not verified/i.test(text)) {
      console.error(
        "  The domain in EMAIL_FROM is not verified in Resend.\n" +
          "  Resend -> Domains -> add the DNS records, then wait for it to show Verified.",
      );
    }
    if (/testing emails|own email address/i.test(text)) {
      console.error(
        "  Resend only allows sending to your own address until a domain is verified.\n" +
          "  Verify a domain before real buyers can be emailed.",
      );
    }
    console.error("");
    process.exit(1);
  }

  const result = JSON.parse(text);
  console.log(`\n  SENT — id ${result.id ?? "(none)"}`);
  console.log(`  Check ${to}, including the spam folder.`);
  console.log("");
  console.log("  If it landed in spam, your DKIM/SPF records are missing or wrong.");
  console.log("  Real buyers will hit the same problem, so it is worth fixing now.");
  console.log("");
} catch (error) {
  console.error(`\n  Could not reach Resend: ${error.message}\n`);
  process.exit(1);
}
