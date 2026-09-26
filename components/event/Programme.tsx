import { Section } from "@/components/event/Section";
import type { GalaEvent } from "@/lib/services/events";
import { cn } from "@/lib/utils";

/**
 * The evening's running order — the page's signature element.
 *
 * Most event pages answer "what's it like?" with three cards carrying three
 * icons. A gala already has a better artifact for this: the programme card
 * on the table, which lists the evening in order with times.
 *
 * The times are the structural device, and they earn their place — an
 * ordered list of clock times is information a guest actually needs (when to
 * arrive, when dinner is served), not decoration standing in for hierarchy.
 * When an entry has no time, the marker becomes a rule instead, so the
 * section still works as a plain list of highlights.
 *
 * Layout: times sit in a right-aligned rail on wide screens, with the
 * continuous hairline of the evening running down beside them. On a phone
 * the rail collapses above each entry.
 */
export function Programme({ event }: { event: GalaEvent }) {
  if (event.experience.length === 0) return null;

  return (
    <Section
      id="evening"
      eyebrow="The evening"
      title="How the night runs"
      lead="So you know when to arrive, and when to be seated."
    >
      <ol className="lg:pl-[10rem]">
        {event.experience.map((entry, index) => {
          const isLast = index === event.experience.length - 1;

          return (
            <li
              key={`${entry.title}-${index}`}
              className="grid gap-x-8 gap-y-2 sm:grid-cols-[7rem_1fr]"
            >
              {/* Time rail */}
              <div className="sm:text-right">
                <p className="tnum pt-0.5 text-sm font-medium text-[var(--color-accent-bright)]">
                  {entry.time ?? ""}
                </p>
              </div>

              {/* The line of the evening, with a node at each entry. The
                  border is on the content column so it runs continuously
                  between items and stops at the last one. */}
              <div
                className={cn(
                  "relative pl-6",
                  // The last entry has nothing below it, so no line and no
                  // trailing gap.
                  isLast ? "pb-0" : "border-l border-[var(--color-line-strong)] pb-10",
                )}
              >
                <span
                  aria-hidden
                  className="absolute top-2 -left-[3.5px] size-[7px] rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_2px_rgba(168,85,247,0.5)]"
                />
                <h3 className="text-[length:var(--text-h3)] font-medium">{entry.title}</h3>
                {entry.description && (
                  <p className="mt-2 max-w-xl leading-relaxed text-[var(--color-ink-secondary)]">
                    {entry.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
