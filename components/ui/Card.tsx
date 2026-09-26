import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A raised dark panel with a hairline border — the site's main content shape.
 *
 * `selected` adds the accent left-edge bar and glow. That is what a ticket
 * tier with a quantity above zero looks like in Phase 4, so the buyer can see
 * at a glance which tiers are in their order.
 */

type CardProps = {
  children: ReactNode;
  /** Highlight state: accent edge bar + glow. */
  selected?: boolean;
  /** Give the card a hover state — only for cards that are clickable. */
  interactive?: boolean;
  as?: ElementType;
  className?: string;
};

export function Card({
  children,
  selected = false,
  interactive = false,
  as: Tag = "div",
  className,
}: CardProps) {
  return (
    <Tag
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)]",
        "border border-[var(--color-line)] bg-[var(--color-surface-raised)]",
        "shadow-[var(--shadow-card)]",
        "transition-[border-color,box-shadow] duration-200",
        "[transition-timing-function:var(--ease-out-soft)]",
        interactive && "hover:border-[var(--color-line-strong)]",
        selected &&
          "border-[var(--color-accent-line)] shadow-[var(--shadow-glow)] " +
            // The 3px accent bar down the left edge.
            "before:absolute before:inset-y-0 before:left-0 before:w-[3px] " +
            "before:bg-[var(--color-accent)] before:content-['']",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Standard inner padding. Tighter on a phone, roomier from `sm` up. */
export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5 sm:p-7", className)}>{children}</div>;
}

/** Title + optional subtitle, as seen above "Choose your tier and quantity." */
export function CardHeader({
  title,
  subtitle,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <h2 className="text-[length:var(--text-h2)] font-semibold">{title}</h2>
      {subtitle && (
        <p className="text-[length:var(--text-body-lg)] text-[var(--color-ink-secondary)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
