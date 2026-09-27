"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge, ButtonLink, Card, CardBody, ErrorMessage, Spinner } from "@/components/ui";
import { formatNaira, kobo } from "@/lib/money";
import type { OrderStatus } from "@/types/database";

/**
 * "Confirming your payment…"
 *
 * THIS PAGE DECIDES NOTHING. It polls a read-only endpoint and reports what
 * it finds. It cannot mark an order paid, and nothing about arriving here
 * makes a payment succeed (spec §3 rule 6).
 *
 * Why polling is necessary: the buyer's browser and the provider's
 * confirmation are two independent journeys. The buyer often gets back
 * first, so the order can still be PENDING for a few seconds through no
 * fault of anyone's.
 *
 * Why it gives up after a while: an order stuck PENDING usually means the
 * confirmation never arrived. A spinner that never stops is worse than an
 * honest "we are still waiting, here is your reference".
 */

const POLL_INTERVAL_MS = 3000;
const GIVE_UP_AFTER_MS = 90_000;

type StatusResponse = {
  status: OrderStatus;
  reference: string;
  totalKobo: number;
  paidAt: string | null;
};

type Phase =
  | { kind: "waiting" }
  | { kind: "paid"; data: StatusResponse }
  | { kind: "failed"; data: StatusResponse }
  | { kind: "timeout" }
  | { kind: "notfound" };

export function PaymentReturn({
  reference,
  token,
}: {
  reference: string;
  token: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "waiting" });
  // Set inside the effect, not during render — reading the clock while
  // rendering is impure and makes the component non-deterministic.
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    startedAt.current ??= Date.now();

    async function poll() {
      try {
        const response = await fetch(
          `/api/orders/status?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );

        if (cancelled) return;

        if (response.status === 404) {
          setPhase({ kind: "notfound" });
          return;
        }

        if (response.ok) {
          const data = (await response.json()) as StatusResponse;

          if (data.status === "PAID") {
            setPhase({ kind: "paid", data });
            return;
          }
          if (["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(data.status)) {
            setPhase({ kind: "failed", data });
            return;
          }
        }
        // Anything else — still PENDING, a 429, a blip — is a reason to wait
        // rather than to declare failure.
      } catch {
        // Offline or a dropped request. Keep trying until the deadline.
      }

      if (cancelled) return;

      if (Date.now() - (startedAt.current ?? Date.now()) > GIVE_UP_AFTER_MS) {
        setPhase({ kind: "timeout" });
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference, token]);

  if (phase.kind === "paid") {
    return (
      <Card selected>
        <CardBody className="space-y-6 text-center">
          <div className="space-y-3">
            <Badge tone="success">Payment received</Badge>
            <h1 className="text-[length:var(--text-h2)]">You&apos;re coming</h1>
            <p className="text-[var(--color-ink-secondary)]">
              Your tickets are ready, and a copy is on its way to your email.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-y border-[var(--color-line)] py-5 text-left">
            <div>
              <dt className="eyebrow text-[var(--color-ink-muted)]">Reference</dt>
              <dd className="tnum mt-1 font-semibold">{phase.data.reference}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[var(--color-ink-muted)]">Paid</dt>
              <dd className="tnum mt-1 font-semibold">
                {formatNaira(kobo(phase.data.totalKobo))}
              </dd>
            </div>
          </dl>

          <ButtonLink href={`/tickets/${token}`} size="lg" fullWidth>
            View your tickets
          </ButtonLink>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Screenshot them when you get there — you will not need signal at the door.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (phase.kind === "failed") {
    return (
      <Card>
        <CardBody className="space-y-5">
          <Badge>{phase.data.status}</Badge>
          <h1 className="text-[length:var(--text-h2)]">Payment not completed</h1>
          <p className="text-[var(--color-ink-secondary)]">
            {phase.data.status === "EXPIRED"
              ? "This order ran out of time and the seats were released. Nothing was charged."
              : "The payment did not go through, so no tickets were issued. Nothing was charged."}
          </p>
          <p className="tnum text-sm text-[var(--color-ink-muted)]">
            Reference {phase.data.reference}
          </p>
          <ButtonLink href="/checkout" size="lg" fullWidth>
            Try again
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  if (phase.kind === "notfound") {
    return (
      <Card>
        <CardBody className="space-y-5">
          <ErrorMessage title="We could not find that order">
            The link may be incomplete. Check the address, or use your reference to get in touch.
          </ErrorMessage>
          <ButtonLink href="/" variant="ghost" fullWidth>
            Back to the event
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  if (phase.kind === "timeout") {
    return (
      <Card>
        <CardBody className="space-y-5">
          <Badge tone="warning">Still waiting</Badge>
          <h1 className="text-[length:var(--text-h2)]">This is taking longer than usual</h1>
          <p className="text-[var(--color-ink-secondary)]">
            Your payment may still come through. If it does, your tickets are emailed to you
            automatically — there is nothing more to do.
          </p>
          <p className="tnum text-sm text-[var(--color-ink-muted)]">Reference {reference}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`/payment/return?ref=${reference}&token=${token}`} fullWidth>
              Check again
            </ButtonLink>
            <Link
              href="/find-tickets"
              className="flex items-center justify-center text-sm text-[var(--color-ink-secondary)] underline underline-offset-4"
            >
              Find my tickets
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-5 py-12 text-center">
        <Spinner size="lg" className="mx-auto text-[var(--color-accent)]" />
        <h1 className="text-[length:var(--text-h2)]">Confirming your payment…</h1>
        <p className="text-[var(--color-ink-secondary)]">
          This usually takes a few seconds. Please do not close this page.
        </p>
        <p className="tnum text-sm text-[var(--color-ink-muted)]">Reference {reference}</p>
      </CardBody>
    </Card>
  );
}
