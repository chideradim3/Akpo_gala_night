"use client";

import Link from "next/link";

import { Button, Checkbox, Input } from "@/components/ui";

/**
 * Step 1 — who the tickets are for.
 *
 * No account and no password (spec §7). The email address is the identity:
 * it is where the tickets go, and it is how someone recovers them later.
 *
 * The form validates on submit, not on every keystroke. Telling someone
 * their email is invalid while they are still typing the second character
 * is noise, and it trains people to ignore the messages.
 *
 * NATIVE VALIDATION IS LEFT ON DELIBERATELY (no `noValidate`).
 *
 * React's checks are the nicer ones and normally run first, but they only
 * exist once the page has hydrated. If the JavaScript ever fails to load,
 * a form with `noValidate` degrades into one that accepts anything and
 * submits it — which is exactly what happened when Next.js blocked its dev
 * chunks over a LAN address. The browser's own `required` and `type=email`
 * checks cost nothing and hold that line whatever else breaks.
 */

export type GuestDetailsValues = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  consent: boolean;
};

export function GuestDetailsStep({
  values,
  errors,
  onChange,
  onSubmit,
}: {
  values: GuestDetailsValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<GuestDetailsValues>) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <h1 className="text-[length:var(--text-h2)]">Your details</h1>
        <p className="text-[var(--color-ink-secondary)]">
          Where should we send your tickets?
        </p>
      </div>

      <div className="space-y-5">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          required
          value={values.email}
          error={errors["details.email"]}
          hint="Your tickets are sent here. Check it carefully."
          onChange={(event) => onChange({ email: event.target.value })}
        />

        {/* Side by side from `sm` up; stacked on a phone, where two half-width
            fields would each be too narrow to read what you typed. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="firstName"
            name="firstName"
            label="First name"
            placeholder="John"
            autoComplete="given-name"
            required
            value={values.firstName}
            error={errors["details.firstName"]}
            onChange={(event) => onChange({ firstName: event.target.value })}
          />
          <Input
            id="lastName"
            name="lastName"
            label="Last name"
            placeholder="Doe"
            autoComplete="family-name"
            required
            value={values.lastName}
            error={errors["details.lastName"]}
            onChange={(event) => onChange({ lastName: event.target.value })}
          />
        </div>

        <Input
          id="phone"
          name="phone"
          type="tel"
          label="Phone number"
          placeholder="08012345678"
          autoComplete="tel"
          inputMode="tel"
          required
          // Deliberately loose — the authoritative check is
          // normalizeNigerianPhone, in React and again on the server. This
          // only has to stop obvious rubbish when JavaScript is unavailable.
          pattern="[0-9+()\-\s]{10,20}"
          title="A Nigerian mobile number, e.g. 08012345678"
          value={values.phone}
          error={errors["details.phone"]}
          hint="In case we need to reach you on the night."
          onChange={(event) => onChange({ phone: event.target.value })}
        />

        <Checkbox
          id="consent"
          name="consent"
          checked={values.consent}
          error={errors["details.consent"]}
          onChange={(event) => onChange({ consent: event.target.checked })}
          label={
            <>
              I agree to my details being used to issue and deliver my tickets, in line
              with the{" "}
              <Link
                href="/privacy"
                className="text-[var(--color-accent-bright)] underline underline-offset-4"
              >
                privacy policy
              </Link>{" "}
              and the Nigeria Data Protection Act.
            </>
          }
        />
      </div>

      <Button type="submit" size="lg" fullWidth>
        Continue to tickets
      </Button>
    </form>
  );
}
