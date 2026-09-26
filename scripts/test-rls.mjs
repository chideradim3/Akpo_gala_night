/**
 * Security test for Row Level Security.
 *
 *   node scripts/test-rls.mjs
 *
 * Requires a LOCAL Supabase (`npx supabase start`).
 *
 * WHAT IT PROVES
 *
 * The policies in migration 06 are a claim: "the browser can read the
 * published event and its active ticket types, and nothing else." Reading
 * the policy list only proves the policies were written. This actually
 * BECOMES the browser — `set role anon`, the exact role the public anon key
 * maps to — and tries the attacks.
 *
 * Every "denied" below is a thing a stranger with your public key cannot do.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

let pass = 0;
let fail = 0;

function report(ok, label, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

let container;

async function findDbContainer() {
  const { stdout } = await exec("docker", [
    "ps", "--filter", "name=supabase_db", "--format", "{{.Names}}",
  ]);
  const name = stdout.trim().split("\n")[0];
  if (!name) {
    throw new Error("No local Supabase container found. Run:  npx supabase start");
  }
  return name;
}

const COMMAND_TAG = /^(INSERT \d+ \d+|UPDATE \d+|DELETE \d+|SELECT \d+|SET|ROLLBACK|BEGIN)$/;

async function run(statement, { asAnon = false } = {}) {
  const sql = asAnon ? `set role anon;\n${statement}` : statement;
  try {
    const { stdout } = await exec(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
       "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    const output = stdout
      .split("\n").map((l) => l.trim())
      .filter((l) => l && !COMMAND_TAG.test(l)).join("\n");
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: String(error.stderr || error.message).trim() };
  }
}

/** Assert the anon role is refused. */
async function expectDenied(statement, label) {
  const result = await run(statement, { asAnon: true });
  const denied = !result.ok || result.output === "0";
  report(denied, label, result.ok ? `returned ${result.output || "nothing"}` : "denied");
}

/**
 * Stronger than expectDenied for writes.
 *
 * A blocked UPDATE can report "UPDATE 0" rather than an error, which looks
 * identical to a query that simply returned nothing. So instead of trusting
 * the command tag, this checks the DATA afterwards, as superuser: did the
 * value actually change? That is the question that matters.
 */
async function expectNoDataChange(statement, checkSql, expected, label) {
  const attempt = await run(statement, { asAnon: true });
  const after = await run(checkSql);
  const unchanged = after.output === expected;
  report(
    unchanged,
    label,
    unchanged
      ? attempt.ok
        ? "silently affected 0 rows"
        : "hard denied"
      : `DATA CHANGED: expected ${expected}, found ${after.output}`,
  );
}

async function main() {
  container = await findDbContainer();
  console.log(`\nActing as the anon role (the public browser key) on ${container}\n`);

  console.log("── What the browser SHOULD be able to read ─────────────────");

  const events = await run("select count(*) from public.events", { asAnon: true });
  report(events.ok && events.output === "1", "Can read the published event", `count ${events.output}`);

  const tiers = await run("select count(*) from public.ticket_types", { asAnon: true });
  report(tiers.ok && Number(tiers.output) > 0, "Can read active ticket types", `count ${tiers.output}`);

  const prices = await run(
    "select count(*) from public.ticket_types where price_kobo > 0", { asAnon: true });
  report(prices.ok && Number(prices.output) > 0, "Can read prices (they are on the public page anyway)");

  console.log("\n── Personal data the browser must NEVER reach ──────────────");
  await expectDenied("select count(*) from public.attendees", "Cannot read attendees (names, emails, phones)");
  await expectDenied("select count(*) from public.orders", "Cannot read orders");
  await expectDenied("select count(*) from public.order_items", "Cannot read order items");
  await expectDenied("select count(*) from public.tickets", "Cannot read tickets or QR tokens");
  await expectDenied("select count(*) from public.admins", "Cannot read the admin list");
  await expectDenied("select count(*) from public.audit_log", "Cannot read the audit trail");

  console.log("\n── Writes the browser must never perform ───────────────────");
  await expectDenied(
    "insert into public.events (name, slug, date) values ('Hacked','hacked', current_date)",
    "Cannot create an event");
  await expectNoDataChange(
    "update public.ticket_types set price_kobo = 1",
    "select price_kobo from public.ticket_types where name = 'VIP table'",
    "20000000",
    "Cannot change a ticket price to ₦0.01 (verified against the real data)");
  await expectDenied(
    "delete from public.audit_log",
    "Cannot erase the audit trail");
  await expectDenied(
    "delete from public.ticket_types",
    "Cannot delete ticket types");
  await expectDenied(
    `select * from public.create_order_with_reservation(
       '5a000000-0000-4000-8000-000000000001'::uuid,
       '5a000000-0000-4000-8000-000000000999'::uuid,
       '[{"ticket_type_id":"5a000000-0000-4000-8000-000000000101","quantity":1}]'::jsonb, 30)`,
    "Cannot create an order directly (rule 3: the browser never writes)");
  await expectDenied(
    "select public.ticket_type_availability('5a000000-0000-4000-8000-000000000101'::uuid)",
    "Cannot call the availability function directly");

  console.log("\n── Unpublished content stays hidden ────────────────────────");

  // Hide the event, confirm it disappears for anon, then put it back.
  await run("update public.events set status = 'DRAFT' where slug = 'akpo-gala-night'");
  const draft = await run("select count(*) from public.events", { asAnon: true });
  report(draft.ok && draft.output === "0",
    "A DRAFT event is invisible to the public", `count ${draft.output}`);
  await run("update public.events set status = 'PUBLISHED' where slug = 'akpo-gala-night'");

  // Same for a deactivated tier.
  await run("update public.ticket_types set is_active = false where name = 'Standard'");
  const hidden = await run(
    "select count(*) from public.ticket_types where name = 'Standard'", { asAnon: true });
  report(hidden.ok && hidden.output === "0",
    "A deactivated ticket type is invisible to the public", `count ${hidden.output}`);
  await run("update public.ticket_types set is_active = true where name = 'Standard'");

  // Leave the database as we found it.
  const restored = await run(
    "select status from public.events where slug = 'akpo-gala-night'");
  report(restored.output === "PUBLISHED", "Database restored to its seeded state");

  console.log(`\n${"─".repeat(60)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nTest run failed: ${error.message}\n`);
  process.exitCode = 1;
});
