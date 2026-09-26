/**
 * Browser Supabase client — ANON KEY ONLY.
 *
 * What this client may do is decided entirely by Row Level Security (Phase 2):
 * read the active event and its active ticket types. Nothing else. It can
 * never write, because non-negotiable rule 3 says the browser never talks to
 * the database for writes — those go through server actions and route handlers.
 *
 * NOTE: intentionally has no `server-only` import; this one IS for the client.
 */
// Phase 2 wires this up:
//   import { createBrowserClient } from "@supabase/ssr";
//   import type { Database } from "@/types/database";

export function createBrowserSupabaseClient(): never {
  throw new Error(
    "Supabase is not wired up yet — this lands in Phase 2 (database migrations & RLS).",
  );
}
