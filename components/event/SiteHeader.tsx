import { ButtonLink, Container } from "@/components/ui";
import type { GalaEvent } from "@/lib/services/events";

/**
 * Site header.
 *
 * Deliberately thin: the wordmark, three anchors, and the one action that
 * matters. A full navigation would be pretending this is a bigger site than
 * it is — there is one page and one thing to do on it.
 *
 * The links are hidden below `md`, where the page is short enough to scroll
 * and a hamburger menu would be three taps to reach content that is already
 * two swipes away. The ticket button stays visible at every width.
 */
export function SiteHeader({ event }: { event: GalaEvent }) {
  const links = [
    { href: "#about", label: "About" },
    { href: "#evening", label: "The evening" },
    { href: "#tickets", label: "Tickets" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface-page)_85%,transparent)] backdrop-blur-md">
      <Container width="wide">
        <div className="flex h-16 items-center justify-between gap-4 sm:h-18">
          {/* min-w-0 lets this shrink instead of pushing the button off the
              edge, and the name stays on one line at any length. */}
          <a
            href="#top"
            className="min-w-0 truncate text-base font-semibold [font-family:var(--font-display)] sm:text-xl"
          >
            {event.name}
          </a>

          <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <ButtonLink href="/checkout" size="sm">
            Get tickets
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
