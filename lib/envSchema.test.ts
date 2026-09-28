import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeEnv, parseEnv } from "./envSchema";

/**
 * These rules exist because a production build failed on them.
 *
 * `PAYMENT_PROVIDER` had been given a blank value in the Vercel dashboard.
 * `z.enum([...]).default("mock")` substitutes the default only for
 * `undefined`, so the empty string reached the enum and was rejected, and
 * the whole deploy died with a code frame that never named the variable.
 *
 * Nothing here needs a database or a network. If one of these starts
 * failing, a deploy is about to.
 */

test("a blank value means the same as an absent one", () => {
  for (const blank of ["", " ", "\n", "\t  \n"]) {
    const result = parseEnv({ PAYMENT_PROVIDER: blank });
    assert.equal(result.ok, true, `blank ${JSON.stringify(blank)} should be accepted`);
    assert.ok(result.ok);
    assert.equal(result.env.PAYMENT_PROVIDER, "mock", "should fall back to the default");
  }
});

test("a blank optional variable reads as undefined, not as an empty string", () => {
  const result = parseEnv({ RESEND_API_KEY: "   ", NEXT_PUBLIC_SITE_URL: "" });
  assert.ok(result.ok);
  assert.equal(result.env.RESEND_API_KEY, undefined);
  assert.equal(result.env.NEXT_PUBLIC_SITE_URL, undefined);
});

test("values pasted with surrounding whitespace are trimmed", () => {
  const result = parseEnv({
    PAYMENT_CONFIRM_SECRET: "  abc123\n",
    EMAIL_PROVIDER: " resend ",
  });
  assert.ok(result.ok);
  assert.equal(result.env.PAYMENT_CONFIRM_SECRET, "abc123");
  assert.equal(result.env.EMAIL_PROVIDER, "resend");
});

test("enum values are case-insensitive", () => {
  const result = parseEnv({ PAYMENT_PROVIDER: "REAL", EMAIL_PROVIDER: "Resend" });
  assert.ok(result.ok);
  assert.equal(result.env.PAYMENT_PROVIDER, "real");
  assert.equal(result.env.EMAIL_PROVIDER, "resend");
});

test("an unrecognised enum value still fails, and the message names the variable", () => {
  const result = parseEnv({ PAYMENT_PROVIDER: "paystack" });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.deepEqual(result.invalid, ["PAYMENT_PROVIDER"]);
  assert.match(result.message, /PAYMENT_PROVIDER/);
  // The message is the only thing a failing deploy log gives you to act on.
  assert.match(result.message, /Vercel/);
});

test("defaults apply when nothing is set at all", () => {
  const result = parseEnv({});
  assert.ok(result.ok);
  assert.equal(result.env.PAYMENT_PROVIDER, "mock");
  assert.equal(result.env.EMAIL_PROVIDER, "console");
  assert.equal(result.env.NODE_ENV, "development");
});

test("normalizeEnv ignores variables outside the schema", () => {
  // SUPABASE_DB_URL and the GitHub token live in .env.local but must never
  // be read by the app, and must never appear in a parsed environment.
  const raw = normalizeEnv({
    SUPABASE_DB_URL: "postgresql://user:password@host/db",
    Repo_Key: "ghp_example",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  });
  assert.deepEqual(Object.keys(raw), ["NEXT_PUBLIC_SITE_URL"]);
});
