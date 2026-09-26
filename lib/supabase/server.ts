import "server-only";

/**
 * Server Supabase client — anon key, but running on the server with the
 * signed-in user's session attached (used by admin pages from Phase 7).
 *
 * Still subject to Row Level Security. For work that must bypass RLS — issuing
 * tickets, reading every order — use `lib/supabase/admin.ts` instead, and only
 * behind a server-side permission check.
 *
 * The `server-only` import above means importing this from a "use client"
 * component is a BUILD ERROR, not a runtime surprise.
 */
// Phase 2 wires this up:
//   import { createServerClient } from "@supabase/ssr";
//   import { cookies } from "next/headers";
//   import { requireSupabaseEnv } from "@/lib/env";

export function createServerSupabaseClient(): never {
  throw new Error(
    "Supabase is not wired up yet — this lands in Phase 2 (database migrations & RLS).",
  );
}
