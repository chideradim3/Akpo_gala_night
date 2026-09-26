import Image from "next/image";

import { Section } from "@/components/event/Section";
import type { GalaEvent } from "@/lib/services/events";
import { cn } from "@/lib/utils";

/**
 * The gallery.
 *
 * Renders nothing at all when there are no images — which is the case until
 * the admin uploads some. An empty section with a placeholder grid would
 * make a new event look unfinished, so the page simply closes the gap.
 *
 * The grid is deliberately uneven: the first image spans two columns on wide
 * screens. A perfectly regular grid of unrelated photographs reads as stock
 * imagery; one dominant frame reads as an edit.
 */
export function Gallery({ event }: { event: GalaEvent }) {
  if (event.gallery.length === 0) return null;

  return (
    <Section id="gallery" eyebrow="Gallery" title="From previous years">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {event.gallery.map((src, index) => (
          <li
            key={src}
            className={cn(
              "relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]",
              // One dominant frame, on wide screens only — on a phone a
              // double-width image would simply be a full-width image.
              index === 0 && "lg:col-span-2 lg:aspect-[8/5]",
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              // Two columns on a phone, three on a laptop.
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
