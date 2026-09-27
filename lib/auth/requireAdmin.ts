import "server-only";

import { redirect } from "next/navigation";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/types/database";

/**
 * The one access check for everything under /admin.
 *
 * ── HOW TO USE IT ────────────────────────────────────────────────────────
 *   const admin = await requireAdmin();          // any admin
 *   const admin = await requireAdmin("owner");   // owners only
 *
 * Call it at the top of every admin page, every server action and every
 * admin API route. Not once in a layout — a layout does not run for a
 * server action, so a page that relies on one is unprotected the moment
 * someone posts directly to its action.
 *
 * The payment developer's /admin/check-in page uses this same call. That is
 * why it lives in its own file with a stable signature: there should be
 * exactly one answer to "is this person allowed?", not one per feature.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Three things must ALL be true (spec §10):
 *
 *   1. Signed in to Supabase Auth.
 *   2. Signed in with two factors — AAL2. A password alone is not enough,
 *      even for a real admin. 2FA is mandatory, not opt-in.
 *   3. Has a row in `admins`. Being able to authenticate is not authority:
 *      anyone who can sign up to the project's auth could clear the first
 *      two, and this table is what makes them an administrator.
 */

export type Admin = {
  userId: string;
  email: string;
  role: AdminRole;
};

/** Owners can do everything a staff member can. */
function satisfies(role: AdminRole, required: AdminRole): boolean {
  return required === "staff" ? true : role === "owner";
}

/**
 * Resolve the current admin, or redirect.
 *
 * Redirect targets carry `next` so the person lands where they were going
 * once they finish signing in.
 */
export async function requireAdmin(required: AdminRole = "staff"): Promise<Admin> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // ── Two factors, not one ────────────────────────────────────────────
  // currentLevel is what they have; nextLevel is the highest their account
  // supports. aal1 with nextLevel aal2 means "enrolled, but has not entered
  // a code this session". nextLevel aal1 means "no authenticator set up" —
  // which is not allowed to reach the admin at all, so they are sent to
  // enrol rather than being quietly let in with a password.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel !== "aal2") {
    redirect(aal?.nextLevel === "aal2" ? "/admin/login?step=verify" : "/admin/login?step=enrol");
  }

  // ── On the list ─────────────────────────────────────────────────────
  // Read with the service role: `admins` has no RLS policy for anyone, so
  // the signed-in user cannot read even their own row. Deliberate — if the
  // browser never learns the answer, no client-side check can be tampered
  // with into granting access. The server decides, every time.
  const { data: adminRow } = await createAdminSupabaseClient()
    .from("admins")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    console.warn("[auth] authenticated user is not an admin", { userId: user.id });
    redirect("/admin/login?error=not-an-admin");
  }

  if (!satisfies(adminRow.role, required)) {
    redirect("/admin?error=insufficient-role");
  }

  return {
    userId: adminRow.user_id,
    email: user.email ?? "",
    role: adminRow.role,
  };
}

/**
 * Like requireAdmin, but returns null instead of redirecting.
 *
 * For the login page, which needs to know whether someone is already
 * through without bouncing them into a loop.
 */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return null;

  const { data: adminRow } = await createAdminSupabaseClient()
    .from("admins")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) return null;

  return { userId: adminRow.user_id, email: user.email ?? "", role: adminRow.role };
}
