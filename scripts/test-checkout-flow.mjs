/**
 * End-to-end checkout test.
 *
 *   npm run test:checkout
 *
 * Drives a real browser through both checkout steps against a real server
 * and a real database, then reads the tables to see what was written.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * Two regressions reached the live site that `npm run build`, `tsc` and the
 * unit suite all passed:
 *
 *   a14cfa7  reordered the checkout so nobody was recorded at all
 *   b4d3b54  fixed it — but nothing could prove either way
 *
 * Both were about the ORDER of four database calls. Nothing that only
 * compiles the code can see that. This runs the thing.
 *
 * It also reproduces the one condition that matters and that `npm run dev`
 * cannot: NODE_ENV=production with PAYMENT_PROVIDER=mock, where the payment
 * provider deliberately refuses. In development the mock succeeds, the
 * refusal path never executes, and the bug is invisible.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Point it at a THROWAWAY database. It writes real rows.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.CHECKOUT_BASE ?? "http://127.0.0.1:3100";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEBUG_PORT = Number(process.env.CHECKOUT_CDP_PORT ?? 9333);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n");
  process.exit(1);
}

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error("\nNo Chrome or Edge found.\n");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** A unique identity per run, so repeated runs never collide. */
const stamp = Date.now();
const IDENTITY = {
  email: `checkout-test-${stamp}@example.test`,
  firstName: "Checkout",
  lastName: `Test${stamp}`,
  // 0810 + 7 digits, inside the mobile ranges normalizeNigerianPhone accepts.
  phone: `0810${String(stamp).slice(-7)}`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── A very small Chrome DevTools Protocol client ──────────────────────────
// Node 22 ships a global WebSocket, which is why package.json pins 22.x.

let nextId = 1;
function cdp(socket) {
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  return function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
    });
  };
}

/** Run an expression in the page and return its value. */
async function evaluate(send, expression) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}

/** Poll an expression until it is truthy, or give up. */
async function waitFor(send, expression, what, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(send, expression)) return true;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// React tracks input state internally, so assigning .value is ignored. The
// native setter plus a bubbling event is what a real keystroke looks like.
const SET_INPUT = `
  function setInput(selector, value) {
    const el = document.querySelector(selector);
    if (!el) throw new Error("no element " + selector);
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
`;

async function main() {
  console.log(`\nChecking out against ${BASE}`);
  console.log(`Database ${SUPABASE_URL}\n`);

  // ── What is in the tables before we touch anything ─────────────────────
  const before = await counts();
  console.log(`  before:  attendees ${before.attendees}   orders ${before.orders}\n`);

  const profile = mkdtempSync(join(tmpdir(), "checkout-"));
  const chrome = execFile(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--window-size=1280,1400",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    "about:blank",
  ]);
  chrome.stderr?.resume();

  let socket;
  try {
    // Chrome needs a moment before the debugging endpoint answers.
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const targets = await res.json();
        target = targets.find((t) => t.type === "page");
      } catch {
        // not up yet
      }
    }
    if (!target) throw new Error("Chrome never exposed a debugging target");

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP socket failed")), {
        once: true,
      });
    });

    const send = cdp(socket);
    await send("Page.enable");
    await send("Runtime.enable");

    // ── Step 1: the buyer's details ──────────────────────────────────────
    await send("Page.navigate", { url: `${BASE}/checkout` });
    await waitFor(send, `!!document.querySelector('#email')`, "the details form");
    // The form only works once React has hydrated and attached its handler.
    await waitFor(
      send,
      `!!document.querySelector('form') && !document.querySelector('form').noValidate === false || true`,
      "hydration",
      1000,
    ).catch(() => {});
    await sleep(1500);

    await evaluate(
      send,
      `${SET_INPUT}
       setInput('#email', ${JSON.stringify(IDENTITY.email)});
       setInput('#firstName', ${JSON.stringify(IDENTITY.firstName)});
       setInput('#lastName', ${JSON.stringify(IDENTITY.lastName)});
       setInput('#phone', ${JSON.stringify(IDENTITY.phone)});
       const consent = document.querySelector('#consent');
       if (!consent.checked) consent.click();
       true;`,
    );
    console.log(`  step 1:  ${IDENTITY.email}`);

    await evaluate(send, `document.querySelector('form button[type="submit"]').click(); true;`);

    // ── Step 2: pick a ticket ────────────────────────────────────────────
    await waitFor(
      send,
      `!!document.querySelector('button[aria-label^="Add one"]')`,
      "the ticket list",
    );
    await evaluate(send, `document.querySelector('button[aria-label^="Add one"]').click(); true;`);
    await sleep(400);

    const tier = await evaluate(
      send,
      `document.querySelector('button[aria-label^="Add one"]').getAttribute('aria-label').replace('Add one ','')`,
    );
    console.log(`  step 2:  1 x ${tier}`);

    // The submit button is the last enabled one in the step's footer.
    await evaluate(
      send,
      `(() => {
         const buttons = [...document.querySelectorAll('button')];
         const go = buttons.reverse().find((b) => /payment|continue/i.test(b.textContent||''));
         if (!go) throw new Error('no continue button');
         go.click();
         return true;
       })()`,
    );

    // ── What came back ───────────────────────────────────────────────────
    await waitFor(
      send,
      `!!document.body.innerText.match(/not available|went wrong|could not|Too many|verify that you are human/i)
         || location.pathname !== '/checkout'`,
      "a response from the server",
      30000,
    );

    const outcome = await evaluate(
      send,
      `(() => {
         const text = document.body.innerText;
         const m = text.match(/[^\\n]*(not available|went wrong|could not|Too many|verify that you are human)[^\\n]*/i);
         return { path: location.pathname, message: m ? m[0].trim() : null };
       })()`,
    );

    console.log(`\n  server said: ${outcome.message ?? "(redirected to " + outcome.path + ")"}\n`);

    // ── The point of the whole exercise ──────────────────────────────────
    const after = await counts();
    const attendee = await findAttendee();

    console.log(`  after:   attendees ${after.attendees}   orders ${after.orders}`);
    console.log(
      `  delta:   attendees +${after.attendees - before.attendees}   orders +${after.orders - before.orders}\n`,
    );

    const results = [
      [
        "the attendee was recorded",
        Boolean(attendee),
        attendee ? `${attendee.first_name} ${attendee.last_name} <${attendee.email}>` : "no row",
      ],
      [
        "the phone was normalised to +234",
        Boolean(attendee?.phone?.startsWith("+234")),
        attendee?.phone ?? "—",
      ],
      [
        "no seats were reserved",
        after.orders === before.orders,
        `${after.orders - before.orders} order(s) created`,
      ],
      [
        "the buyer was told payment is unavailable",
        /not available/i.test(outcome.message ?? ""),
        outcome.message ?? "no message",
      ],
    ];

    let failed = 0;
    for (const [label, ok, detail] of results) {
      if (!ok) failed += 1;
      console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
      console.log(`        ${detail}`);
    }

    console.log(
      `\n${"─".repeat(60)}\n${results.length - failed} passed, ${failed} failed\n`,
    );
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    try {
      socket?.close();
    } catch {
      // already gone
    }
    chrome.kill();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Windows sometimes still holds the profile; harmless.
    }
  }
}

async function counts() {
  const [a, o] = await Promise.all([
    db.from("attendees").select("*", { count: "exact", head: true }),
    db.from("orders").select("*", { count: "exact", head: true }),
  ]);
  if (a.error) throw new Error(`attendees: ${a.error.message}`);
  if (o.error) throw new Error(`orders: ${o.error.message}`);
  return { attendees: a.count ?? 0, orders: o.count ?? 0 };
}

async function findAttendee() {
  const { data } = await db
    .from("attendees")
    .select("first_name, last_name, email, phone")
    .eq("email", IDENTITY.email)
    .maybeSingle();
  return data;
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
