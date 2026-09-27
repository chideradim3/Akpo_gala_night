"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  signInAction,
  startEnrolmentAction,
  verifyCodeAction,
  type Step,
} from "@/app/admin/login/actions";
import { Badge, Button, Card, CardBody, ErrorMessage, Input } from "@/components/ui";

/**
 * Admin sign-in, in two steps.
 *
 * Password first, then a code from an authenticator app. An admin who has
 * never set one up is walked through it here rather than being let in — 2FA
 * is a condition of access, not a setting (spec §10).
 *
 * Nothing on this screen decides anything. It calls server actions and
 * shows what they return; the session's level and the `admins` row are
 * checked again on the server for every page and action after this.
 */

type Enrolment = { factorId: string; qrCodeSvg: string; secret: string };

export function LoginForm({ initialStep }: { initialStep: Step }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePassword() {
    setError(null);
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.step === "enrol") {
        const enrol = await startEnrolmentAction();
        if (!enrol.ok) {
          setError(enrol.message);
          return;
        }
        setEnrolment(enrol.enrolment ?? null);
        setStep("enrol");
        return;
      }

      setStep("verify");
    });
  }

  function handleCode() {
    setError(null);
    startTransition(async () => {
      const result = await verifyCodeAction({ code, factorId: enrolment?.factorId });
      if (!result.ok) {
        setError(result.message);
        setCode("");
        return;
      }
      // The session cookie has just been upgraded to aal2 by the server
      // action. push() sends the new cookie with the RSC request, and
      // refresh() makes sure nothing cached from the aal1 session survives.
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <Badge tone="accent">Staff only</Badge>
          <h1 className="text-[length:var(--text-h2)]">
            {step === "password" ? "Admin sign in" : step === "enrol" ? "Set up two-factor" : "Enter your code"}
          </h1>
          <p className="text-[var(--color-ink-secondary)]">
            {step === "password"
              ? "This area is for event staff."
              : step === "enrol"
                ? "Two-factor authentication is required. Scan this with your authenticator app."
                : "Open your authenticator app and enter the current 6-digit code."}
          </p>
        </div>

        {error && <ErrorMessage title={error} />}

        {step === "password" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handlePassword();
            }}
            className="space-y-5"
          >
            <Input
              id="admin-email"
              name="email"
              type="email"
              label="Email address"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              id="admin-password"
              name="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={isPending}>
              Continue
            </Button>
          </form>
        )}

        {step === "enrol" && enrolment && (
          <div className="space-y-5">
            {/* Supabase returns the QR as an SVG data URL. */}
            <div className="mx-auto w-full max-w-[15rem] rounded-[var(--radius-control)] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrolment.qrCodeSvg}
                alt="QR code for your authenticator app"
                className="block h-auto w-full"
              />
            </div>

            <div className="space-y-2 text-center">
              <p className="eyebrow text-[var(--color-ink-muted)]">Or type this in</p>
              <p className="tnum break-all text-sm font-semibold">{enrolment.secret}</p>
              <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
                Use Google Authenticator, Authy, 1Password or similar.{" "}
                <strong className="text-[var(--color-ink-secondary)]">
                  Save the code above somewhere safe
                </strong>{" "}
                — losing your phone without it means losing access.
              </p>
            </div>

            <CodeEntry
              code={code}
              setCode={setCode}
              onSubmit={handleCode}
              pending={isPending}
              label="Confirm the 6-digit code"
            />
          </div>
        )}

        {step === "verify" && (
          <CodeEntry
            code={code}
            setCode={setCode}
            onSubmit={handleCode}
            pending={isPending}
            label="6-digit code"
          />
        )}

        {step !== "password" && (
          <button
            type="button"
            onClick={() => {
              setStep("password");
              setEnrolment(null);
              setCode("");
              setError(null);
              router.refresh();
            }}
            className="w-full text-center text-sm text-[var(--color-ink-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
          >
            Start again
          </button>
        )}
      </CardBody>
    </Card>
  );
}

function CodeEntry({
  code,
  setCode,
  onSubmit,
  pending,
  label,
}: {
  code: string;
  setCode: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <Input
        id="admin-code"
        name="code"
        label={label}
        // One-time-code lets a phone offer the value from its SMS/app
        // autofill, and numeric keeps the keypad on mobile.
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder="000000"
        required
        autoFocus
        value={code}
        className="tnum text-center text-2xl tracking-[0.5em]"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <Button type="submit" size="lg" fullWidth loading={pending} disabled={code.length !== 6}>
        Verify and sign in
      </Button>
    </form>
  );
}
