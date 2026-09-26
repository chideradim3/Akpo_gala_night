import { cn } from "@/lib/utils";

/**
 * The 1 · 2 · 3 progress indicator above the checkout.
 *
 * Responsive behaviour, since this is the element most likely to break on a
 * 375px phone: the connecting lines shrink, labels drop to a very small size
 * and wrap to two lines rather than being truncated, and the whole row stays
 * within the viewport with no horizontal scroll.
 *
 * A completed step shows a tick, the current step shows its number in a
 * glowing accent circle, and upcoming steps are dimmed.
 */

export type StepperStep = { label: string };

export function Stepper({
  steps,
  /** 1-based index of the step the buyer is on. */
  current,
  className,
}: {
  steps: StepperStep[];
  current: number;
  className?: string;
}) {
  return (
    <nav aria-label="Checkout progress" className={cn("w-full", className)}>
      <ol className="flex items-start justify-center">
        {steps.map((step, index) => {
          const position = index + 1;
          const isDone = position < current;
          const isCurrent = position === current;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className={cn("flex items-start", !isLast && "flex-1")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex w-16 shrink-0 flex-col items-center gap-2 sm:w-24">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full text-sm font-semibold",
                    "transition-[background-color,box-shadow,color] duration-300",
                    "[transition-timing-function:var(--ease-out-soft)]",
                    (isDone || isCurrent) &&
                      "bg-[var(--color-accent)] text-white shadow-[var(--shadow-glow-soft)]",
                    !isDone &&
                      !isCurrent &&
                      "border border-[var(--color-line-strong)] bg-transparent text-[var(--color-ink-muted)]",
                  )}
                >
                  {isDone ? (
                    <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                      <path
                        d="M3 8.5 6.5 12 13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    position
                  )}
                  <span className="sr-only">
                    {isDone ? " (completed)" : isCurrent ? " (current step)" : ""}
                  </span>
                </span>

                <span
                  className={cn(
                    "eyebrow text-center leading-tight text-[0.5625rem] sm:text-[0.6875rem]",
                    isCurrent ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-5 h-px min-w-2 flex-1",
                    isDone ? "bg-[var(--color-accent-line)]" : "bg-[var(--color-line-strong)]",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
