import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server-side client using the PUBLIC anon key, with no user session.
 *
 * For reading public content — the event and its ticket tiers — from server
 * components. It has exactly the permissions the browser has, which is the
 * point: Row Level Security is what decides what comes back, not a `.eq()`
 * the developer has to remember to write.
 *
 * Why not just use the admin client, which is already here and can read
 * everything? Because `getPublishedEvent()` filters on status='PUBLISHED' in
 * application code, and one day someone will edit that query. With the admin
 * client, dropping the filter silently publishes a draft event. With this
 * client, the database refuses regardless — the filter becomes a second lock
 * rather than the only one.
 *
 * It runs on the server, not in the browser, so there is no extra round trip
 * and nothing is shipped to the client.
 */

let client: ReturnType<typeof createClient<Database>> | undefined;

export function createPublicSupabaseClient() {
  const { url, anonKey } = requireSupabaseEnv();

  client ??= createClient<Database>(url, anonKey, {
    auth: {
      // No user, no browser, nothing to persist.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
