import { Section } from "@/components/event/Section";
import type { GalaEvent } from "@/lib/services/events";

/**
 * The About section.
 *
 * Set at a larger size than body copy and held to a narrow measure. It is
 * the one place on the page with a human voice, so it is given room rather
 * than being packed into a three-column grid.
 *
 * Blank lines in the admin's text become paragraphs.
 */
export function About({ event }: { event: GalaEvent }) {
  if (!event.about?.trim()) return null;

  const paragraphs = event.about
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <Section id="about" eyebrow="About">
      <div className="max-w-3xl space-y-6 lg:pl-[10rem]">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="text-[length:var(--text-h3)] leading-[1.55] text-[var(--color-ink-secondary)] [&:first-child]:text-[var(--color-ink)]"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </Section>
  );
}
