"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { checkRateLimit, clientIpFrom } from "@/lib/rateLimit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Admin sign-in: password, then a second factor. Always both (spec §10).
 *
 * The steps are separate server actions rather than one, because Supabase
 * issues an aal1 session after the password and upgrades it to aal2 only
 * once a TOTP code is verified. `requireAdmin()` accepts nothing below
 * aal2, so a half-finished sign-in can reach no admin page.
 */

/** Deliberately vague. See the note in signInAction. */
const BAD_CREDENTIALS = "Those details did not work. Please try again.";

const credentialsSchema = z.object({
  email: z.string().trim().min(1).max(254).pipe(z.email()),
  password: z.string().min(1).max(200),
});

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app");

export type Step = "password" | "enrol" | "verify" | "done";

export type AuthResult =
  | { ok: true; step: Step; enrolment?: { factorId: string; qrCodeSvg: string; secret: string } }
  | { ok: false; message: string };

/** Step 1 — email and password. */
export async function signInAction(input: unknown): Promise<AuthResult> {
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  // Tight, because this is the front door to every order and attendee in
  // the system and a legitimate admin needs very few attempts.
  const limit = checkRateLimit(`admin-login:${ip}`, { limit: 6, windowSeconds: 300 });
  if (!limit.allowed) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  }

  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: BAD_CREDENTIALS };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // One message for "no such account" and "wrong password". Telling them
    // apart turns this form into a way of discovering which addresses have
    // admin accounts, which is the first step of attacking one.
    console.warn("[admin-login] failed", { ip, reason: error.message });
    return { ok: false, message: BAD_CREDENTIALS };
  }

  // Password accepted. Now find out whether they have a second factor.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factors?.totp?.find((factor) => factor.status === "verified");

  return { ok: true, step: verifiedTotp ? "verify" : "enrol" };
}

/**
 * Step 2a — set up an authenticator, for an admin who has none.
 *
 * Returns a QR code to scan and the secret to type in by hand. The factor
 * is not usable until a code from it has been verified, so enrolling does
 * not by itself grant anything.
 */
export async function startEnrolmentAction(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired. Please sign in again." };

  // Clear out abandoned attempts; Supabase refuses a duplicate name and
  // half-finished factors otherwise pile up.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `authenticator-${Date.now()}`,
  });

  if (error || !data) {
    console.error("[admin-login] enrol failed", error);
    return { ok: false, message: "Could not start two-factor setup. Please try again." };
  }

  return {
    ok: true,
    step: "enrol",
    enrolment: {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

/**
 * Step 2b — verify a 6-digit code.
 *
 * Used both to finish enrolment and to sign in on later visits. On success
 * the session becomes aal2, which is the only level `requireAdmin` accepts.
 */
export async function verifyCodeAction(input: {
  code: unknown;
  factorId?: string;
}): Promise<AuthResult> {
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  // A 6-digit code is one in a million, and a code is valid for ~30
  // seconds. Without a limit here, guessing becomes realistic.
  const limit = checkRateLimit(`admin-totp:${ip}`, { limit: 8, windowSeconds: 300 });
  if (!limit.allowed) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  }

  const parsedCode = codeSchema.safeParse(input.code);
  if (!parsedCode.success) {
    return { ok: false, message: parsedCode.error.issues[0].message };
  }

  const supabase = await createServerSupabaseClient();

  let factorId = input.factorId;
  if (!factorId) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    factorId = factors?.totp?.find((factor) => factor.status === "verified")?.id;
  }
  if (!factorId) {
    return { ok: false, message: "No authenticator is set up for this account." };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    console.error("[admin-login] challenge failed", challengeError);
    return { ok: false, message: "Could not verify the code. Please try again." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: parsedCode.data,
  });

  if (error) {
    console.warn("[admin-login] bad code", { ip });
    return {
      ok: false,
      message: "That code was not accepted. Check your app and try the current code.",
    };
  }

  return { ok: true, step: "done" };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
