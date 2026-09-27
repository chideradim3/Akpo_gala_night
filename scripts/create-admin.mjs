/**
 * Create an administrator.
 *
 *   npm run create-admin -- --email you@example.com --role owner
 *   npm run create-admin -- --email staff@example.com --role staff
 *   npm run create-admin -- --email you@example.com --password "..." --role owner
 *
 * There is deliberately no admin sign-up page (spec §5). An administrator
 * exists only because someone with the service-role key made one, which is
 * why this is a script you run on your own machine and not a route.
 *
 * It does two things: creates the Supabase Auth user (or reuses an existing
 * one with that email), and adds the row in `admins` that actually grants
 * access. Both are needed — being able to sign in is not authority.
 *
 * Two-factor is NOT set up here. The admin does that themselves on first
 * sign-in, by scanning a QR code with their own phone. A secret you
 * generate for someone else and send them is not a second factor.
 *
 * Roles:
 *   owner  everything — settings, prices, exports
 *   staff  view only, plus check-in once it exists
 */

import { randomBytes } from "node:crypto";
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

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const env = loadEnvLocal();

const email = args.email?.trim().toLowerCase();
const role = args.role ?? "owner";
// A generated password is better than one a person invents on the spot, and
// it is shown once so it can go straight into a password manager.
const password = args.password ?? `${randomBytes(12).toString("base64url")}Aa1!`;

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !email.includes("@")) {
  fail("Missing --email.\n  npm run create-admin -- --email you@example.com --role owner");
}
if (!["owner", "staff"].includes(role)) fail("--role must be 'owner' or 'staff'");
if (!url || !serviceKey) fail("Supabase is not configured in .env.local. See SUPABASE_SETUP.md.");

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

/** Find an existing auth user with this email, if there is one. */
async function findUser() {
  const response = await fetch(
    `${url}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: authHeaders },
  );
  if (!response.ok) return null;
  const body = await response.json();
  return (body.users ?? []).find((user) => user.email?.toLowerCase() === email) ?? null;
}

console.log(`\nCreating admin ${email} (${role})…\n`);

let user = await findUser();
let createdNow = false;

if (user) {
  console.log("  An auth user with that email already exists — reusing it.");
  console.log("  Their existing password is unchanged.");
} else {
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email,
      password,
      // No confirmation email: this account is being created deliberately
      // by someone who already holds the service-role key.
      email_confirm: true,
    }),
  });

  if (!response.ok) {
    fail(`Could not create the auth user: ${response.status} ${await response.text()}`);
  }

  user = await response.json();
  createdNow = true;
}

// The row that actually grants access.
const grant = await fetch(`${url}/rest/v1/admins?on_conflict=user_id`, {
  method: "POST",
  headers: {
    ...authHeaders,
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({ user_id: user.id, role }),
});

if (!grant.ok) {
  fail(`Created the user but could not grant admin access: ${grant.status} ${await grant.text()}`);
}

console.log("  Auth user:   " + user.id);
console.log("  Admin row:   granted as " + role);
console.log("");
console.log("  Sign in at:  /admin/login");
console.log("  Email:       " + email);
if (createdNow) {
  console.log("  Password:    " + password);
  console.log("");
  console.log("  ^ Shown once. Save it in a password manager now.");
}
console.log("");
console.log("  On first sign-in you will be asked to scan a QR code with an");
console.log("  authenticator app. That is required — there is no way past it,");
console.log("  and no admin page will load without it.");
console.log("");
