import type { Metadata } from "next";
import Link from "next/link";

import { FindTicketsForm } from "@/app/find-tickets/FindTicketsForm";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Find my tickets",
  robots: { index: false, follow: true },
};

export default function FindTicketsPage() {
  return (
    <main id="main" className="flex flex-1 items-center py-16">
      <Container width="narrow" className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
        >
          <span aria-hidden>&larr;</span> Back to the event
        </Link>
        <FindTicketsForm />
      </Container>
    </main>
  );
}
