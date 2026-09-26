import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server Supabase client — anon key, carrying the signed-in user's session.
 *
 * Use this when the answer should depend on *who is asking*: the admin login
 * flow and session handling from Phase 7.
 *
 * It is still subject to Row Level Security, which is the point. For work
 * that must see everything — reading any order, issuing tickets — use
 * `lib/supabase/admin.ts` instead, and only after an authorisation check.
 *
 * The `server-only` import makes importing this from a "use client"
 * component a BUILD ERROR rather than a runtime surprise.
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. That is expected and fine:
          // session refresh happens in route handlers and server actions,
          // which can. Swallowing it here keeps pages from crashing.
        }
      },
    },
  });
}
