import type { ReactNode } from "react";

import { Container, type ContainerWidth } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * A landing-page section.
 *
 * The page has eight of them, and eight identical stacked bands is how a page
 * ends up looking like a template. So the eyebrow label sits in a left rail
 * on wide screens, against the heading — a magazine device rather than the
 * usual centred-heading-over-centred-body.
 *
 * Vertical rhythm lives here, in one place, so sections cannot drift apart.
 */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  width = "wide",
  className,
}: {
  id?: string;
  /** Short label, e.g. "The evening". Doubles as the section's landmark name. */
  eyebrow?: string;
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  width?: ContainerWidth;
  className?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-24 py-20 sm:py-28", className)}
    >
      <Container width={width}>
        {(eyebrow || title || lead) && (
          <div className="mb-12 grid gap-x-12 gap-y-4 lg:grid-cols-[10rem_1fr] lg:mb-16">
            {eyebrow && (
              <p className="eyebrow pt-1 text-[var(--color-accent-bright)] lg:text-right">
                {eyebrow}
              </p>
            )}
            <div className="max-w-2xl space-y-5">
              {title && (
                <h2 id={headingId} className="text-[length:var(--text-h2)]">
                  {title}
                </h2>
              )}
              {lead && (
                <p className="text-[length:var(--text-body-lg)] leading-relaxed text-[var(--color-ink-secondary)]">
                  {lead}
                </p>
              )}
            </div>
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

/**
 * A hairline that spans the content column.
 *
 * Used between sections instead of a background colour change, which is what
 * keeps the page reading as one continuous card rather than a stack of bands.
 */
export function SectionRule({ width = "wide" }: { width?: ContainerWidth }) {
  return (
    <Container width={width} aria-hidden>
      <hr className="border-0 border-t border-[var(--color-line)]" />
    </Container>
  );
}
