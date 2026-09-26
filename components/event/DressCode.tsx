import { Container } from "@/components/ui";
import type { GalaEvent } from "@/lib/services/events";

/**
 * The dress code.
 *
 * Given a band of its own rather than a line in a list, because for a gala
 * it is the single instruction guests most want confirmed — and getting it
 * wrong is the thing they are most anxious about.
 *
 * It is set at display size with nothing competing: one statement, centred,
 * quiet. This is the page's moment of deliberate emptiness.
 */
export function DressCode({ event }: { event: GalaEvent }) {
  if (!event.dressCode?.trim()) return null;

  return (
    <section id="dress-code" aria-labelledby="dress-code-heading" className="scroll-mt-24 py-24 sm:py-32">
      <Container width="medium">
        <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 100%, rgba(168,85,247,0.16), transparent 70%)",
            }}
          />
          <p id="dress-code-heading" className="eyebrow text-[var(--color-ink-muted)]">
            Dress code
          </p>
          <p className="mt-6 text-[length:var(--text-h1)] leading-tight font-medium [font-family:var(--font-display)]">
            {event.dressCode}
          </p>
        </div>
      </Container>
    </section>
  );
}
