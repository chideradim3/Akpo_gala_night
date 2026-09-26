"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Browser Supabase client — ANON KEY ONLY.
 *
 * What this client may do is decided entirely by Row Level Security, not by
 * this file: read the published event and its active ticket types. That is
 * the whole list. It cannot read an order, an attendee or a ticket, and it
 * cannot write anything at all — the browser never writes to the database
 * (non-negotiable rule 3).
 *
 * The anon key is public on purpose. It is in the page source of every
 * Supabase site on the internet. It is safe *because* of RLS, which is why
 * the policies in migration 06 matter more than hiding this value.
 *
 * Most pages will not need this. Prefer reading data on the server and
 * passing it down as props — fewer round trips and nothing extra shipped to
 * the browser.
 *
 * NOTE: intentionally no `server-only` import. This one IS for the client.
 */

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createBrowserSupabaseClient() {
  // The browser cannot use lib/env.ts (it is server-only), so it reads the
  // NEXT_PUBLIC_ variables directly. They must be written out in full rather
  // than looked up dynamically — Next.js inlines them at build time and a
  // computed key would come back undefined.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server. " +
        "See SUPABASE_SETUP.md.",
    );
  }

  // Reused across calls so a page with several components does not open
  // several connections.
  client ??= createBrowserClient<Database>(url, anonKey);
  return client;
}
