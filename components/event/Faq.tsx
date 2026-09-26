import { Section } from "@/components/event/Section";
import type { GalaEvent } from "@/lib/services/events";

/**
 * Frequently asked questions.
 *
 * Built on native <details>/<summary>. No JavaScript, no state, no library:
 * it is keyboard accessible, announced correctly by screen readers, and
 * works before the page has hydrated — which matters on a 4G phone.
 *
 * Deliberately a single column even on wide screens. Two columns of
 * expanding panels make the page jump around as one side grows.
 */
export function Faq({ event }: { event: GalaEvent }) {
  if (event.faq.length === 0) return null;

  return (
    <Section id="faq" eyebrow="Questions" title="Before you come">
      <div className="max-w-3xl lg:pl-[10rem]">
        {event.faq.map((entry, index) => (
          <details
            key={index}
            name="faq"
            className="group border-b border-[var(--color-line)] first:border-t"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
              <span className="text-[length:var(--text-h3)] leading-snug font-medium [font-family:var(--font-display)]">
                {entry.question}
              </span>
              {/* A plus that becomes a minus. Rotation rather than swapping
                  glyphs, so it animates and never reflows the row. */}
              <span
                aria-hidden
                className="relative mt-1.5 size-4 shrink-0 text-[var(--color-accent-bright)]"
              >
                <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 bg-current" />
                <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 rotate-90 bg-current transition-transform duration-300 [transition-timing-function:var(--ease-out-soft)] group-open:rotate-0" />
              </span>
            </summary>
            <p className="max-w-2xl pb-6 leading-relaxed text-[var(--color-ink-secondary)]">
              {entry.answer}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
