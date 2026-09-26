/**
 * Concurrency test for create_order_with_reservation().
 *
 *   node scripts/test-inventory-race.mjs
 *
 * Requires a LOCAL Supabase (`npx supabase start`). It writes and deletes
 * data, so it must never be pointed at a real project — it refuses to run
 * against anything but the local container.
 *
 * WHAT IT PROVES
 *
 * Unit tests cannot catch an overselling bug, because overselling only
 * happens when two requests interleave at exactly the wrong moment. So this
 * test creates that moment on purpose: it sets a tier to ONE remaining
 * ticket and fires several real order attempts at the database at once.
 *
 * Correct behaviour is exactly one success and the rest cleanly rejected
 * with GN001 ("not enough tickets left"). Two successes would mean you have
 * sold a VIP table that does not exist.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const EVENT_ID = "5a000000-0000-4000-8000-000000000001";
const VIP_ID = "5a000000-0000-4000-8000-000000000101";
const STANDARD_ID = "5a000000-0000-4000-8000-000000000103";
const CONCURRENT_BUYERS = 6;

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

/* ── Talking to the local database ──────────────────────────────────────── */

async function findDbContainer() {
  const { stdout } = await exec("docker", [
    "ps",
    "--filter",
    "name=supabase_db",
    "--format",
    "{{.Names}}",
  ]);
  const name = stdout.trim().split("\n")[0];
  if (!name) {
    throw new Error(
      "No local Supabase database container found. Start it with:  npx supabase start",
    );
  }
  return name;
}

let container;

/**
 * psql prints a command tag after a write — "INSERT 0 1", "UPDATE 3" — on its
 * own line, even in tuples-only mode. Left in, it gets concatenated onto the
 * value we actually asked for and the next query receives a malformed UUID.
 */
const COMMAND_TAG = /^(INSERT \d+ \d+|UPDATE \d+|DELETE \d+|SELECT \d+|COPY \d+|MERGE \d+)$/;

function stripCommandTags(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !COMMAND_TAG.test(line))
    .join("\n");
}

/** Run SQL and return the result rows. Throws with the Postgres error text. */
async function sql(statement) {
  try {
    const { stdout } = await exec(
      "docker",
      [
        "exec", "-i", container,
        "psql", "-U", "postgres", "-d", "postgres",
        "-t", "-A", "-F", "|",
        // Without this, psql prints the error MESSAGE but not its SQLSTATE,
        // and these tests assert on the code (GN001…GN005) because that is
        // what lib/services/orders.ts will branch on — not on wording.
        "-v", "VERBOSITY=verbose",
        "-c", statement,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    return stripCommandTags(stdout);
  } catch (error) {
    const message = String(error.stderr || error.message).trim();
    throw new Error(message);
  }
}

/** Like sql(), but returns { ok, output } instead of throwing. */
async function trySql(statement) {
  try {
    return { ok: true, output: await sql(statement) };
  } catch (error) {
    return { ok: false, output: error.message };
  }
}

/* ── The test ───────────────────────────────────────────────────────────── */

async function main() {
  container = await findDbContainer();
  console.log(`\nUsing local database container: ${container}\n`);

  // Safety: refuse to touch anything that is not the seeded sample event.
  const eventName = await sql(`select name from public.events where id = '${EVENT_ID}'`);
  if (eventName !== "Gala Night") {
    throw new Error(
      "The seeded sample event was not found. Run `npx supabase db reset` first. " +
        "This script must never run against real data.",
    );
  }

  console.log("── Setup ───────────────────────────────────────────────────");
  // Clear any orders from a previous run so availability starts clean.
  await sql(`delete from public.orders where event_id = '${EVENT_ID}'`);
  // One VIP table left in the world.
  await sql(`update public.ticket_types set inventory = 1 where id = '${VIP_ID}'`);

  const attendeeId = await sql(`
    insert into public.attendees (email, first_name, last_name, phone)
    values ('race-test@example.com', 'Race', 'Test', '+2348000000001')
    on conflict (email) do update set first_name = excluded.first_name
    returning id
  `);
  console.log(`  VIP inventory set to 1, test attendee ready\n`);

  const before = await sql(`select public.ticket_type_availability('${VIP_ID}')`);
  report(before === "1", "Availability starts at 1", `got ${before}`);

  // ── The race ──────────────────────────────────────────────────────────
  console.log(`\n── ${CONCURRENT_BUYERS} buyers grab the last VIP table at once ──`);

  const attempts = Array.from({ length: CONCURRENT_BUYERS }, () =>
    trySql(`
      select order_id, total_kobo
      from public.create_order_with_reservation(
        '${EVENT_ID}'::uuid,
        '${attendeeId}'::uuid,
        '[{"ticket_type_id":"${VIP_ID}","quantity":1}]'::jsonb,
        30
      )
    `),
  );

  const results = await Promise.all(attempts);
  const succeeded = results.filter((r) => r.ok);
  const rejected = results.filter((r) => !r.ok);

  succeeded.forEach((r, i) => console.log(`  buyer ${i + 1}: SOLD    ${r.output.split("|")[0]}`));
  rejected.forEach((r, i) =>
    console.log(`  buyer ${succeeded.length + i + 1}: refused  ${r.output.split("\n")[0].slice(0, 90)}`),
  );

  console.log();
  report(
    succeeded.length === 1,
    "Exactly one buyer got the table",
    `${succeeded.length} succeeded, ${rejected.length} refused`,
  );
  report(
    rejected.every((r) => /GN001|Not enough tickets/i.test(r.output)),
    "Everyone else was refused for the right reason (GN001, not a crash)",
  );

  const after = await sql(`select public.ticket_type_availability('${VIP_ID}')`);
  report(after === "0", "Availability is now 0", `got ${after}`);

  const orderCount = await sql(
    `select count(*) from public.order_items where ticket_type_id = '${VIP_ID}'`,
  );
  report(orderCount === "1", "Exactly one order line exists in the database", `got ${orderCount}`);

  // ── The hold expires and the seat comes back ──────────────────────────
  console.log("\n── A hold that expires releases the seat ───────────────────");
  await sql(`
    update public.orders
       set expires_at = now() - interval '1 minute'
     where event_id = '${EVENT_ID}' and status = 'PENDING'
  `);
  const afterExpiry = await sql(`select public.ticket_type_availability('${VIP_ID}')`);
  report(
    afterExpiry === "1",
    "Seat is available again once the hold lapses — with no cleanup job run",
    `got ${afterExpiry}`,
  );

  const swept = await sql(`select public.expire_overdue_orders()`);
  report(Number(swept) >= 1, "expire_overdue_orders() tidied the status column", `${swept} order(s)`);

  // ── Validation rules ──────────────────────────────────────────────────
  console.log("\n── Validation rejects bad requests ─────────────────────────");

  const overLimit = await trySql(`
    select * from public.create_order_with_reservation(
      '${EVENT_ID}'::uuid, '${attendeeId}'::uuid,
      '[{"ticket_type_id":"${STANDARD_ID}","quantity":999}]'::jsonb, 30)
  `);
  report(!overLimit.ok && /GN002/.test(overLimit.output), "Quantity above max_per_order is refused (GN002)");

  const closed = await trySql(`
    select * from public.create_order_with_reservation(
      '${EVENT_ID}'::uuid, '${attendeeId}'::uuid,
      '[{"ticket_type_id":"5a000000-0000-4000-8000-000000000104","quantity":1}]'::jsonb, 30)
  `);
  report(!closed.ok && /GN003/.test(closed.output), "A closed sale window is refused (GN003)");

  const empty = await trySql(`
    select * from public.create_order_with_reservation(
      '${EVENT_ID}'::uuid, '${attendeeId}'::uuid, '[]'::jsonb, 30)
  `);
  report(!empty.ok && /GN005/.test(empty.output), "An empty selection is refused (GN005)");

  // ── Prices come from the database, not the caller ─────────────────────
  console.log("\n── Prices are taken from the database ──────────────────────");
  await sql(`delete from public.orders where event_id = '${EVENT_ID}'`);
  const priced = await sql(`
    select total_kobo from public.create_order_with_reservation(
      '${EVENT_ID}'::uuid, '${attendeeId}'::uuid,
      '[{"ticket_type_id":"${STANDARD_ID}","quantity":3}]'::jsonb, 30)
  `);
  // Standard is ₦5,000 = 500000 kobo. Three of them = 1500000.
  report(priced === "1500000", "3 x Standard totals 1,500,000 kobo (₦15,000)", `got ${priced}`);

  // ── Tidy up ───────────────────────────────────────────────────────────
  await sql(`delete from public.orders where event_id = '${EVENT_ID}'`);
  await sql(`delete from public.attendees where email = 'race-test@example.com'`);
  await sql(`update public.ticket_types set inventory = 8 where id = '${VIP_ID}'`);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nTest run failed: ${error.message}\n`);
  process.exitCode = 1;
});
