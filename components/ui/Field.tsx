import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared label / hint / error wrapper for every form control.
 *
 * Centralising this is what guarantees each input is actually accessible:
 * the label points at the control, and the hint and error are announced by
 * screen readers via `aria-describedby`, which the inputs below wire up from
 * the ids this helper generates.
 */

export function fieldIds(id: string) {
  return { hintId: `${id}-hint`, errorId: `${id}-error` };
}

/** The value for `aria-describedby`, or undefined when there is nothing to say. */
export function describedBy(id: string, hint?: ReactNode, error?: string) {
  const { hintId, errorId } = fieldIds(id);
  const parts = [hint ? hintId : null, error ? errorId : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { hintId, errorId } = fieldIds(id);
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--color-accent)]" aria-hidden>
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--color-ink-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** The shared visual treatment for input, textarea and select. */
export const controlClasses = cn(
  "w-full rounded-[var(--radius-control)] px-4",
  "border border-[var(--color-line)] bg-[var(--color-surface-inset)]",
  "text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]",
  // 16px on mobile stops iOS Safari zooming in when the field is focused —
  // that zoom is the most common cause of a "broken" mobile form.
  "text-base sm:text-[0.9375rem]",
  "transition-[border-color,background-color] duration-200",
  "hover:border-[var(--color-line-strong)]",
  "focus:border-[var(--color-accent-line)] focus:bg-[var(--color-surface-raised)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-[var(--color-danger)]",
);
