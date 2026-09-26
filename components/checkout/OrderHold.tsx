"use client";

import { useEffect, useState } from "react";

import { Badge, ButtonLink, Card, CardBody } from "@/components/ui";
import { formatNaira, kobo } from "@/lib/money";

/**
 * Shown once the order exists and its inventory is reserved.
 *
 * INTERIM SCREEN. In Phase 5 the buyer will be redirected straight to the
 * payment provider from here, and this page will not be seen. It exists now
 * so Phase 4 can be tested end to end — you can place a real order, watch
 * availability drop, and watch the hold expire.
 *
 * The countdown is honest about what is happening: the seats are held, not
 * bought, and the hold runs out.
 */

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const totalSeconds = Math.floor(remaining / 1000);
  return {
    expired: remaining <= 0,
    label: `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`,
  };
}

export function OrderHold({
  order,
}: {
  order: { reference: string; accessToken: string; totalKobo: number; expiresAt: string };
}) {
  const { expired, label } = useCountdown(order.expiresAt);

  return (
    <div className="space-y-5">
      <Card selected>
        <CardBody className="space-y-6">
          <div className="space-y-2">
            <Badge tone={expired ? "neutral" : "warning"}>
              {expired ? "Hold expired" : "Seats held"}
            </Badge>
            <h1 className="text-[length:var(--text-h2)]">Your order is reserved</h1>
            <p className="text-[var(--color-ink-secondary)]">
              {expired
                ? "This hold has run out and the seats have been released. Please start again."
                : "Your seats are held while you pay. Nothing has been charged yet."}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--color-line)] py-6">
            <div>
              <dt className="eyebrow text-[var(--color-ink-muted)]">Reference</dt>
              <dd className="tnum mt-1 font-semibold">{order.reference}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[var(--color-ink-muted)]">Total</dt>
              <dd className="tnum mt-1 font-semibold">
                {formatNaira(kobo(order.totalKobo))}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="eyebrow text-[var(--color-ink-muted)]">
                {expired ? "Held for" : "Time remaining"}
              </dt>
              <dd
                className={
                  "tnum mt-1 text-[length:var(--text-h3)] font-semibold " +
                  (expired ? "text-[var(--color-ink-muted)]" : "text-[var(--color-accent-bright)]")
                }
              >
                {expired ? "0:00" : label}
              </dd>
            </div>
          </dl>

          {/* Clearly marked so nobody mistakes this for a finished feature. */}
          <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-line-strong)] bg-white/[0.02] p-4">
            <p className="eyebrow text-[var(--color-ink-muted)]">Not built yet</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
              Payment arrives in the next phase. At that point this screen is replaced by a
              redirect to the payment provider, and you will land back on a page that confirms
              your tickets.
            </p>
          </div>

          <ButtonLink href="/" variant="ghost" fullWidth>
            Back to the event
          </ButtonLink>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-[var(--color-ink-muted)]">
        Keep your reference: <span className="tnum">{order.reference}</span>
      </p>
    </div>
  );
}
