import Link from "next/link";

import { Container } from "@/components/ui";
import { formatEventDateShort, formatVenue } from "@/lib/formatEvent";
import type { GalaEvent } from "@/lib/services/events";

export function SiteFooter({ event }: { event: GalaEvent }) {
  const venue = formatVenue(event);

  return (
    <footer className="mt-8 border-t border-[var(--color-line)] py-12">
      <Container width="wide">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xl font-medium [font-family:var(--font-display)]">{event.name}</p>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {formatEventDateShort(event.date)}
              {venue ? ` · ${venue}` : ""}
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link
              href="/checkout"
              className="text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
            >
              Buy tickets
            </Link>
            <Link
              href="/find-tickets"
              className="text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
            >
              Find my tickets
            </Link>
            {event.contactEmail && (
              <a
                href={`mailto:${event.contactEmail}`}
                className="text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
              >
                Contact
              </a>
            )}
          </nav>
        </div>

        <p className="mt-10 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-muted)]">
          © {new Date().getFullYear()} {event.name}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
