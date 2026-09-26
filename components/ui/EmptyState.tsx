import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shown where a list has nothing in it — no orders yet, no search results,
 * no tickets on sale. Always says what the person can do next rather than
 * leaving a blank panel.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-14 text-center",
        "border border-dashed border-[var(--color-line-strong)] bg-white/[0.015]",
        className,
      )}
    >
      <p className="text-[length:var(--text-h3)] font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-[var(--color-ink-secondary)]">{description}</p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
