import Image from "next/image";

import { Container } from "@/components/ui";

import luxuryImage from "@/public/images/luxury.jpg";

/**
 * The sponsor's advert.
 *
 * This band used to hold the dress code, set large and centred. The dress
 * code is still on the page — it is one of the particulars under the hero,
 * beside the date and the venue — so nothing was lost by giving the space
 * over to the sponsor.
 *
 * ── WHY THE IMAGE SETS ITS OWN HEIGHT ───────────────────────────────────
 * The artwork is not cropped, at any width. It is a supplied advert with a
 * bottle, a face and a line of type near the bottom edge; forcing it into a
 * panel of some other shape would cut one of them off, and on a wide screen
 * a square source in a letterbox frame loses most of the picture.
 *
 * So the frame takes its shape FROM the image rather than imposing one:
 * `w-full h-auto` with the intrinsic size Next reads from the file at build
 * time. The section is exactly as tall as the artwork needs, the space is
 * reserved before it loads so the page does not jump, and a replacement
 * file of any proportion simply works — no crop, no stretch, nothing to
 * adjust here.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function Sponsor() {
  return (
    <section id="sponsor" aria-labelledby="sponsor-heading" className="scroll-mt-24 py-20 sm:py-28">
      <Container width="medium">
        <figure>
          {/* The image fills the frame edge to edge — no inner padding, no
              background showing through. The rounding is on the frame and
              clipped, which is what keeps the corners clean on a photograph
              that runs right to its own edges. */}
          <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)]">
            <Image
              src={luxuryImage}
              // Describes what is actually in the picture. A sponsor's
              // advert is content, not decoration, so it is not alt="".
              alt="Sponsor: Ciù Ciù Gotico wine — experience the taste of luxury"
              // Container width="medium" is max-w-4xl (56rem), so a phone
              // never downloads the desktop-sized file.
              sizes="(min-width: 56rem) 56rem, 100vw"
              placeholder="blur"
              className="h-auto w-full"
            />
          </div>

          {/* Two hairlines meeting the word, which is what keeps a one-word
              caption from reading as a stray label. The rules take the
              accent at low opacity; the word stays muted, so it reads as a
              credit rather than a heading. */}
          <figcaption
            id="sponsor-heading"
            className="mt-6 flex items-center justify-center gap-4"
          >
            <span aria-hidden className="h-px w-8 bg-[var(--color-accent-line)]" />
            <span className="eyebrow text-[var(--color-ink-muted)]">Sponsor</span>
            <span aria-hidden className="h-px w-8 bg-[var(--color-accent-line)]" />
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
