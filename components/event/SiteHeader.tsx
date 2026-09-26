import { ButtonLink, Container } from "@/components/ui";

/**
 * Site header — one thing only: the ticket button, always within reach.
 *
 * No wordmark (the hero below carries the name) and no section links. There
 * is one page and one action on it, so the bar does nothing except keep that
 * action pinned while the visitor reads.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface-page)_85%,transparent)] backdrop-blur-md">
      <Container width="wide">
        <div className="flex h-16 items-center justify-end sm:h-18">
          <ButtonLink href="/checkout" size="sm">
            Get tickets
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
