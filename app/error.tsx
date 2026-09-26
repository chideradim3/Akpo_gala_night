"use client";

import { useEffect } from "react";

import { Button, Container, ErrorMessage } from "@/components/ui";

/**
 * Root error boundary.
 *
 * Spec §11: users never see a raw error. The real message is logged for us;
 * the visitor gets a sentence and a way forward. `digest` is the id Next.js
 * assigns to the server-side error so it can be matched up in the logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main id="main" className="flex flex-1 items-center py-24">
      <Container width="narrow" className="space-y-6">
        <h1 className="text-[length:var(--text-h1)] font-bold">Something went wrong</h1>
        <ErrorMessage title="We could not load this page">
          Please try again. If it keeps happening, contact us and we will sort it out.
        </ErrorMessage>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
        </div>
        {error.digest && (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Reference: <span className="tnum">{error.digest}</span>
          </p>
        )}
      </Container>
    </main>
  );
}
