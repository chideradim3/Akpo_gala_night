import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Small status pill.
 *
 * Reused across phases for order status (PENDING / PAID / FAILED / EXPIRED /
 * CANCELLED / REFUNDED) and ticket status (ACTIVE / USED / CANCELLED), so the
 * same state always looks the same wherever it appears.
 */

const tones = {
  neutral: "bg-white/[0.06] text-[var(--color-ink-secondary)] border-[var(--color-line)]",
  accent:
    "bg-[var(--color-accent-soft)] text-[var(--color-accent-bright)] border-[var(--color-accent-line)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/30",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]/30",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/30",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-1",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
