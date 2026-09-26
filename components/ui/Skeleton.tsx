import { cn } from "@/lib/utils";

/**
 * Placeholder block shown while real content loads (spec §12).
 *
 * Give it the same shape as the thing it replaces so the layout does not jump
 * when the data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-[var(--radius-control)] bg-white/[0.06]",
        className,
      )}
    />
  );
}

/** Convenience: a few lines of placeholder text. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
