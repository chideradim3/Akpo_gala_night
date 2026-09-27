"use client";

import { useState, useTransition } from "react";

import { findTicketsAction } from "@/app/find-tickets/actions";
import { Button, Card, CardBody, Input } from "@/components/ui";

/**
 * The recovery form.
 *
 * Tickets are never shown here, only sent (spec §7). That is deliberate:
 * this page has no proof of who is typing, so displaying anything would
 * hand a guest list to whoever asked. Sending to the address already on the
 * order means only the real owner of that inbox sees anything.
 */
export function FindTicketsForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await findTicketsAction(email);
      if (result.invalid) {
        setError(result.message);
        return;
      }
      setSentMessage(result.message);
    });
  }

  if (sentMessage) {
    return (
      <Card>
        <CardBody className="space-y-4 text-center">
          <h1 className="text-[length:var(--text-h2)]">Check your inbox</h1>
          <p className="text-[var(--color-ink-secondary)]">{sentMessage}</p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Emails usually arrive within a minute. If nothing turns up, get in touch and we will
            look it up by hand.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-[length:var(--text-h2)]">Find my tickets</h1>
          <p className="text-[var(--color-ink-secondary)]">
            Enter the email address you used to buy. We will send your tickets to that address
            again.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <Input
            id="find-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            error={error}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Button type="submit" size="lg" fullWidth loading={isPending}>
            Send my tickets
          </Button>
        </form>

        {/* Set expectations before they press it, so a blank inbox does not
            look like a failure. */}
        <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
          For your privacy we always show the same message, whether or not that address has
          tickets. Nothing is displayed on this page — your tickets only ever go to the inbox they
          were bought with.
        </p>
      </CardBody>
    </Card>
  );
}
