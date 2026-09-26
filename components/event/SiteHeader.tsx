import { ButtonLink, Container } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Site header.
 *
 * Deliberately thin: a few anchors and the one action that matters. There is
 * one page and one thing to do on it, so a full navigation would be
 * pretending this is a bigger site than it is.
 *
 * No wordmark. The event name is already the largest thing on the page,
 * directly below — repeating it in the bar says nothing new and competes
 * with the hero for attention.
 *
 * The links stay visible at every width rather than collapsing into a
 * hamburger: three anchors on a page this short do not justify hiding
 * content behind an extra tap. "The evening" is the longest and the least
 * urgent, so it is the one that steps aside on the narrowest phones.
 */
export function SiteHeader() {
  const links = [
    { href: "#about", label: "About", hideOnSmall: false },
    { href: "#evening", label: "The evening", hideOnSmall: true },
    { href: "#tickets", label: "Tickets", hideOnSmall: false },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface-page)_85%,transparent)] backdrop-blur-md">
      <Container width="wide">
        <div className="flex h-16 items-center justify-between gap-4 sm:h-18">
          <nav aria-label="Sections" className="flex min-w-0 items-center gap-5 sm:gap-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "shrink-0 text-[0.8125rem] text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)] sm:text-sm",
                  link.hideOnSmall && "hidden sm:inline",
                )}
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
