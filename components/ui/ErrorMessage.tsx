import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A friendly, human error.
 *
 * Spec §11: users never see a raw database or provider error. Callers pass a
 * sentence someone can act on ("That ticket type just sold out") and log the
 * technical detail server-side.
 */
export function ErrorMessage({
  title = "Something went wrong",
  children,
  className,
}: {
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-[var(--radius-control)] border px-4 py-3.5",
        "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]",
        className,
      )}
    >
      <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--color-danger)]">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="10" cy="13.75" r="0.9" fill="currentColor" />
      </svg>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
        {children && (
          <p className="text-sm text-[var(--color-ink-secondary)]">{children}</p>
        )}
      </div>
    </div>
  );
}
