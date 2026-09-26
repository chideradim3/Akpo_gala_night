import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Checkbox with the label to its right.
 *
 * Built for the NDPA consent box in checkout step 1, where the label contains
 * a link to the privacy policy — so `label` is a ReactNode, not a string.
 *
 * The native input is visually hidden but still focusable; the visible box is
 * a sibling styled off `peer-checked` / `peer-focus-visible`. Screen readers
 * and keyboard users get the real control.
 */
type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  label: ReactNode;
  error?: string;
};

export function Checkbox({ id, label, error, className, ...rest }: CheckboxProps) {
  const errorId = `${id}-error`;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
          {...rest}
        />
        <label
          htmlFor={id}
          className={cn(
            // 44px tap target around a 20px box: the padding is the hit area.
            "mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center",
            "rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface-inset)]",
            "transition-colors duration-150",
            "peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)]",
            // The tick is a DESCENDANT of this label, not a sibling of the input,
            // so the peer variant has to reach it from here.
            "peer-checked:[&_svg]:scale-100",
            "peer-focus-visible:outline peer-focus-visible:outline-2",
            "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent-bright)]",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            error && "border-[var(--color-danger)]",
          )}
        >
          <svg
            viewBox="0 0 14 14"
            aria-hidden
            className="size-3 scale-0 text-white transition-transform duration-150"
          >
            <path
              d="M2 7.5 5.5 11 12 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </label>
        <label
          htmlFor={id}
          className="cursor-pointer text-sm leading-relaxed text-[var(--color-ink-secondary)]"
        >
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="text-xs font-medium text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
