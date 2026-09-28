import { z } from "zod";

/**
 * The shape of the server environment, and the rules for reading it.
 *
 * ── WHY THIS IS A SEPARATE FILE FROM `lib/env.ts` ───────────────────────
 * `lib/env.ts` imports `server-only`, which is what stops a client
 * component ever importing a secret. That guard also makes the module
 * unimportable from Node's test runner, so the parsing rules below could
 * not be tested where they lived — and they are exactly the kind of rules
 * that break a production deploy quietly.
 *
 * This file holds no values and reads nothing from the environment. It is
 * a schema and a pure function, so it is safe without the guard, and
 * `lib/envSchema.test.ts` can exercise it directly.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every variable the project will ever need is declared here, but variables
 * belonging to a later phase are OPTIONAL — the app must boot with an empty
 * .env.local. Each service validates its own requirements when it is
 * actually used (see `requireSupabaseEnv()` in lib/env.ts), so a missing key
 * produces a readable message at the point of use instead of a blank screen.
 */

const optionalNonEmpty = z.string().min(1).optional();

/**
 * An enum read case-insensitively, with surrounding space ignored, falling
 * back to `fallback` when the variable is absent.
 *
 * These values are typed into a hosting dashboard by hand. `PAYMENT_PROVIDER
 * = "Mock "` means exactly what `"mock"` means, and failing a whole
 * deployment over a stray capital or a trailing space would be pedantry
 * rather than safety. A genuinely unrecognised value — say `"paystack"` —
 * still fails loudly, which is the case worth catching.
 */
function looseEnum<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(values).default(fallback),
  );
}

export const serverSchema = z.object({
  NODE_ENV: looseEnum(["development", "test", "production"], "development"),

  // ── Phase 2: Supabase ──────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: optionalNonEmpty,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  /** SERVER ONLY. Bypasses Row Level Security. Never expose to the browser. */
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmpty,

  // ── Phase 4: bot protection ────────────────────────────────────────────
  /** Blank = Turnstile disabled, which is the correct local-dev default. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalNonEmpty,
  TURNSTILE_SECRET_KEY: optionalNonEmpty,

  // ── Phase 5: payment boundary ──────────────────────────────────────────
  NEXT_PUBLIC_SITE_URL: optionalNonEmpty,
  PAYMENT_PROVIDER: looseEnum(["mock", "real"], "mock"),
  /** HMAC-SHA256 key for the X-Signature header on /api/payments/confirm. */
  PAYMENT_CONFIRM_SECRET: optionalNonEmpty,

  // ── Phase 6: email ─────────────────────────────────────────────────────
  EMAIL_PROVIDER: looseEnum(["console", "resend"], "console"),
  RESEND_API_KEY: optionalNonEmpty,
  EMAIL_FROM: optionalNonEmpty,
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Narrow a raw environment to the variables we know about, trimming each
 * and treating a blank one as absent.
 *
 * A hosting dashboard makes it very easy to create a row with an empty
 * value, or to paste one carrying a trailing space or newline. All of those
 * mean "not set", and the schema must not be able to tell them apart — a
 * blank `PAYMENT_PROVIDER` has to fall back to its default exactly as a
 * missing one does.
 *
 * It could tell them apart before this existed, and that broke a production
 * build: `z.enum([…]).default("mock")` substitutes the default only for
 * `undefined`, so an empty string went straight to the enum and was
 * rejected. Locally everything passed, because a .env file is edited by
 * hand and never contains a stray space.
 */
export function normalizeEnv(source: Record<string, string | undefined>) {
  const raw: Record<string, string> = {};
  for (const key of Object.keys(serverSchema.shape)) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed !== "") raw[key] = trimmed;
  }
  return raw;
}

export type EnvResult =
  | { ok: true; env: ServerEnv }
  | { ok: false; message: string; invalid: string[] };

/** Parse an environment. Returns the problem rather than throwing, so the
 *  caller decides whether a bad value is fatal. */
export function parseEnv(source: Record<string, string | undefined>): EnvResult {
  const parsed = serverSchema.safeParse(normalizeEnv(source));
  if (parsed.success) return { ok: true, env: parsed.data };

  const invalid = parsed.error.issues.map((issue) => issue.path.join(".") || "(unknown)");
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(unknown)"}: ${issue.message}`)
    .join("\n");

  const message = [
    `Invalid environment configuration:`,
    problems,
    ``,
    `Locally: copy .env.example to .env.local and fill in the values for the`,
    `phase you are working on.`,
    `On Vercel: Settings -> Environment Variables. Fix the variables named`,
    `above, then redeploy.`,
  ].join("\n");

  return { ok: false, message, invalid };
}
