import "server-only";

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
 * opinion about who is asking — it will happily read or write anything.
 *
 * Legitimate callers, by phase:
 *   4  order creation + atomic inventory reservation
 *   5  confirmOrderPayment / issueTickets
 *   6  resending tickets
 *   7+ admin pages, after verifying the caller has an `admins` row
 *   9  check-in
 */
// Phase 2 wires this up:
//   import { createClient } from "@supabase/supabase-js";
//   import { requireServiceRoleKey, requireSupabaseEnv } from "@/lib/env";

export function createAdminSupabaseClient(): never {
  throw new Error(
    "Supabase is not wired up yet — this lands in Phase 2 (database migrations & RLS).",
  );
}
