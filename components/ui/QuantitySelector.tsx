"use client";

import { cn } from "@/lib/utils";

/**
 * The − / value / + control on each ticket tier card.
 *
 * Controlled: the parent owns the number. In Phase 4 the checkout holds all
 * the quantities so it can compute a total and cap the order — this component
 * only reports intent.
 *
 * Both buttons are 44×44 CSS pixels — the accessibility minimum for a touch
 * target. It matters here more than anywhere else on the site: this is the
 * control a buyer taps repeatedly on a phone, and an undersized − is how
 * someone accidentally buys two VIP tables.
 */

export function QuantitySelector({
  value,
  onChange,
  min = 0,
  max = 10,
  disabled = false,
  /** Announced to screen readers, e.g. "VIP table". */
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label: string;
}) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  const buttonClasses = cn(
    "grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)]",
    "text-lg leading-none text-[var(--color-ink)]",
    "transition-colors duration-150",
    "enabled:hover:bg-white/[0.08] enabled:active:bg-white/[0.12]",
    "disabled:cursor-not-allowed disabled:text-[var(--color-ink-muted)] disabled:opacity-40",
  );

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)]",
        "border border-[var(--color-line)] bg-[var(--color-surface-inset)]",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={!canDecrease}
        aria-label={`Remove one ${label}`}
        className={buttonClasses}
      >
        &minus;
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className="tnum min-w-9 text-center text-base font-semibold"
      >
        {value}
        <span className="sr-only"> {label}</span>
      </span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        aria-label={`Add one ${label}`}
        className={buttonClasses}
      >
        +
      </button>
    </div>
  );
}
