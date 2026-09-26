import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireServiceRoleKey, requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * SERVICE-ROLE Supabase client — BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * ── Non-negotiable rule 4 ────────────────────────────────────────────────
 * SUPABASE_SERVICE_ROLE_KEY is only ever used in server code. Never import
 * this file, directly or transitively, into a client component. The
 * `server-only` import above turns that mistake into a build failure.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every caller must do its own authorisation check FIRST. This client has no
 * opinion about who is asking — it will happily read or write anything. RLS
 * is not protecting you here; your own code is the only thing that is.
 *
 * Legitimate callers, by phase:
 *   4  order creation + atomic inventory reservation
 *   5  confirmOrderPayment / issueTickets
 *   6  resending tickets
 *   7+ admin pages, after `requireAdmin()` (lib/auth) has passed
 *
 * The payment developer's /admin/check-in page will be another caller. It is
 * held to the same rule: `requireAdmin('staff')` first, then this client.
 */

let client: ReturnType<typeof createClient<Database>> | undefined;

export function createAdminSupabaseClient() {
  const { url } = requireSupabaseEnv();
  const serviceRoleKey = requireServiceRoleKey();

  client ??= createClient<Database>(url, serviceRoleKey, {
    auth: {
      // There is no user here and no browser to persist to. Without these the
      // client tries to manage a session it does not have.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
