"use client";

import { useState, useTransition } from "react";

import { simulatePaymentAction } from "@/app/dev/mock-payment/actions";
import { Badge, Button, Card, CardBody, ErrorMessage } from "@/components/ui";
import { formatNaira, kobo } from "@/lib/money";

/**
 * DEVELOPMENT ONLY. Delete with the rest of the mock.
 *
 * Styled to look obviously unlike the rest of the site, so nobody mistakes
 * it for a real payment screen in a screenshot or a demo.
 */
export function MockPaymentPanel({
  reference,
  amountKobo,
  returnUrl,
}: {
  reference: string;
  amountKobo: number;
  returnUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function simulate(outcome: "success" | "failed") {
    setError(null);
    startTransition(async () => {
      const result = await simulatePaymentAction({ reference, amountKobo, outcome });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setDone(result.message);
      // Go where the real provider would send them. The return page then
      // polls the order and reports whatever actually happened.
      window.location.assign(returnUrl);
    });
  }

  return (
    <Card className="border-dashed border-[var(--color-warning)]/40">
      <CardBody className="space-y-6">
        <div className="space-y-3">
          <Badge tone="warning">Development only</Badge>
          <h1 className="text-[length:var(--text-h2)]">Simulated payment</h1>
          <p className="text-[var(--color-ink-secondary)]">
            Standing in for the payment provider. Both buttons call the real
            <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.8125rem]">
              /api/payments/confirm
            </code>
            route with a correctly signed request — exactly what the payment developer&apos;s
            system will do.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-y border-[var(--color-line)] py-5">
          <div>
            <dt className="eyebrow text-[var(--color-ink-muted)]">Reference</dt>
            <dd className="tnum mt-1 font-semibold">{reference}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[var(--color-ink-muted)]">Amount</dt>
            <dd className="tnum mt-1 font-semibold">{formatNaira(kobo(amountKobo))}</dd>
          </div>
        </dl>

        {error && <ErrorMessage title="Simulation failed">{error}</ErrorMessage>}
        {done && <p className="text-sm text-[var(--color-success)]">{done} Redirecting…</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="accent"
            size="lg"
            fullWidth
            loading={isPending}
            onClick={() => simulate("success")}
          >
            Simulate success
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            disabled={isPending}
            onClick={() => simulate("failed")}
          >
            Simulate failure
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
          Each press sends a new payment reference. To test that a repeated webhook does not
          issue a second set of tickets, use{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5">
            npm run simulate-payment
          </code>
          , which lets you send the same one twice.
        </p>
      </CardBody>
    </Card>
  );
}
