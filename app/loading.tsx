import { Container, Skeleton, SkeletonText } from "@/components/ui";

/**
 * Shown while the event loads (spec §12).
 *
 * Shaped like the hero it replaces — rules, name, particulars — so the page
 * does not jump when the real content arrives.
 */
export default function Loading() {
  return (
    <main className="py-20 sm:py-28">
      <Container width="wide">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <Skeleton className="mx-auto h-3 w-28" />
          <div className="border-y border-[var(--color-line)] py-10">
            <Skeleton className="mx-auto h-16 w-full max-w-lg sm:h-24" />
          </div>
          <SkeletonText lines={2} className="mx-auto max-w-xl" />
          <Skeleton className="mx-auto h-14 w-56 rounded-[var(--radius-pill)]" />
        </div>
        <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 border-t border-[var(--color-line)] pt-10 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Container>
    </main>
  );
}
