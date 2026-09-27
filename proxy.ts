import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the admin's Supabase session alive.
 *
 * Access tokens expire after an hour. Refreshing one writes new cookies,
 * and a Server Component cannot set cookies — so without this, an admin
 * would be silently signed out mid-task and lose whatever they were doing.
 *
 * This runs BEFORE the page and can set cookies, so it is the right place.
 *
 * It refreshes the session and nothing else. It makes no decision about who
 * is allowed where: that is `requireAdmin()` in lib/auth, checked inside
 * every admin route and action. Authorising here instead would be a
 * mistake — a proxy is easy to bypass with a matcher change, and the check
 * belongs next to the data it protects.
 *
 * In Next 16 this file is `proxy.ts`, not `middleware.ts`, and the exported
 * function is `proxy`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet: let the request through and let the page explain.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), not getSession(): it verifies the token with Supabase rather
  // than trusting what is in the cookie. Slower, and the only version worth
  // relying on. The return value is deliberately unused — the call is what
  // triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * Admin routes only.
   *
   * Every match costs a round trip to Supabase to verify the token. The
   * public site has no session to refresh, so running this there would make
   * the landing page and checkout slower for no benefit at all.
   */
  matcher: ["/admin/:path*"],
};
