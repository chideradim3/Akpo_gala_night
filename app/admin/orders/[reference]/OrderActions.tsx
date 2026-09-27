"use client";

import { useState, useTransition } from "react";

import { resendTicketsAction, setRefundFlagAction } from "@/app/admin/orders/actions";
import { Button, Card, CardBody, ErrorMessage, Textarea } from "@/components/ui";

/**
 * The two things an admin can do to an order.
 *
 * Both are server actions that re-check permission themselves — this
 * component only shows or hides buttons, which is presentation, not
 * security. A staff member can resend tickets; only an owner can touch the
 * refund flag, and the server enforces that whatever this renders.
 */
export function OrderActions({
  reference,
  email,
  canResend,
  needsRefund,
  refundReason,
  isOwner,
}: {
  reference: string;
  email: string;
  canResend: boolean;
  needsRefund: boolean;
  refundReason: string | null;
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = useState("");

  function run(work: () => Promise<{ ok: boolean; message: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <h2 className="text-[length:var(--text-h3)]">Actions</h2>

        {message &&
          (message.ok ? (
            <p className="rounded-[var(--radius-control)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
              {message.text}
            </p>
          ) : (
            <ErrorMessage title={message.text} />
          ))}

        <div className="space-y-3">
          <div>
            <Button
              variant="ghost"
              fullWidth
              disabled={!canResend || isPending}
              onClick={() => run(() => resendTicketsAction(reference))}
            >
              Email the tickets again
            </Button>
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              {canResend
                ? `Sends the same tickets to ${email}. It never issues new ones.`
                : "Only paid orders have tickets to send."}
            </p>
          </div>

          {isOwner && (
            <div className="space-y-3 border-t border-[var(--color-line)] pt-4">
              {needsRefund ? (
                <>
                  <div className="rounded-[var(--radius-control)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--color-warning)]">
                      Awaiting refund
                    </p>
                    {refundReason && (
                      <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
                        {refundReason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    fullWidth
                    loading={isPending}
                    onClick={() =>
                      run(() => setRefundFlagAction({ reference, flagged: false }))
                    }
                  >
                    Mark the refund as handled
                  </Button>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Refund the payment in your provider&apos;s dashboard first. This only clears
                    the reminder.
                  </p>
                </>
              ) : (
                <>
                  <Textarea
                    id="refund-reason"
                    label="Flag for refund"
                    rows={2}
                    placeholder="Why does this need refunding?"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button
                    variant="danger"
                    fullWidth
                    loading={isPending}
                    onClick={() =>
                      run(() => setRefundFlagAction({ reference, flagged: true, reason }))
                    }
                  >
                    Flag for refund
                  </Button>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    This moves no money. It records that a refund is owed so it is not forgotten.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
