import "server-only";

import { z } from "zod";

/**
 * Server environment.
 *
 * Every variable the project will ever need is declared here, but variables
 * belonging to a later phase are OPTIONAL — the app must boot today with an
 * empty .env.local. Each service validates its own requirements when it is
 * actually used (see `requireSupabaseEnv()` etc. below), so a missing key
 * produces a readable message at the point of use instead of a blank screen.
 *
 * NEVER import this from a client component. `server-only` makes that a build
 * error rather than a leaked secret.
 */

const optionalNonEmpty = z
  .string()
  .trim()
  .min(1)
  .optional()
  // Treat an empty .env value ("FOO=") the same as an absent one.
  .or(z.literal("").transform(() => undefined));

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

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
  PAYMENT_PROVIDER: z.enum(["mock", "real"]).default("mock"),
  /** HMAC-SHA256 key for the X-Signature header on /api/payments/confirm. */
  PAYMENT_CONFIRM_SECRET: optionalNonEmpty,

  // ── Phase 6: email ─────────────────────────────────────────────────────
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: optionalNonEmpty,
  EMAIL_FROM: optionalNonEmpty,
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${problems}\n\n` +
        `Copy .env.example to .env.local and fill in the values for the phase you are working on.`,
    );
  }

  return parsed.data;
}

export const env: ServerEnv = loadEnv();

export const isProduction = env.NODE_ENV === "production";

/**
 * Phase 2+. Call from Supabase client factories so a missing key gives a
 * sentence a human can act on, not `TypeError: Cannot read properties of
 * undefined`.
 */
export function requireSupabaseEnv() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local — see SUPABASE_SETUP.md.",
    );
  }
  return { url, anonKey };
}

/** Phase 2+. The service-role key, for server code only. */
export function requireServiceRoleKey(): string {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required for server-side " +
        "writes. See SUPABASE_SETUP.md. Never put this key in a NEXT_PUBLIC_ variable.",
    );
  }
  return key;
}

/** Phase 5+. The secret the payment confirm route verifies signatures with. */
export function requirePaymentConfirmSecret(): string {
  const secret = env.PAYMENT_CONFIRM_SECRET;
  if (!secret) {
    throw new Error(
      "PAYMENT_CONFIRM_SECRET is not set. /api/payments/confirm cannot verify " +
        "request signatures without it — see PAYMENT_INTEGRATION.md.",
    );
  }
  return secret;
}

/** Phase 5+. Absolute base URL, used to build the payment return URL. */
export function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
