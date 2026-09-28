import "server-only";

import { parseEnv, type ServerEnv } from "@/lib/envSchema";

/**
 * The server environment, parsed once at startup.
 *
 * The schema and the parsing rules live in `lib/envSchema.ts` so they can
 * be unit-tested; this module is the one that actually holds the values,
 * and `server-only` makes importing it from a client component a build
 * error rather than a leaked secret.
 */

export type { ServerEnv };

function loadEnv(): ServerEnv {
  const result = parseEnv(process.env);

  if (!result.ok) {
    // Printed as well as thrown. A failing build surfaces this as a code
    // frame around the `throw`, which shows the source line but not always
    // the message — and the message is the only part that says what to fix.
    console.error(`\n${result.message}\n`);
    throw new Error(result.message);
  }

  return result.env;
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
