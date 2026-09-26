import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-4 border-2",
  md: "size-5 border-2",
  lg: "size-8 border-[3px]",
} as const;

/**
 * Indeterminate loading indicator. Required by spec §12 for order creation,
 * admin tables and scanning.
 *
 * `currentColor` for the visible arc so it inherits from whatever it sits in —
 * white on a dark button, black on the white primary button.
 */
export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: keyof typeof sizes;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-current/25 border-t-current",
        sizes[size],
        className,
      )}
    />
  );
}
