import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The ONE place page width and side gutters are decided.
 *
 * Pages use this instead of hand-rolling `max-w-* mx-auto px-*`, which is how
 * widths stay consistent across all ten phases. Change a number here and every
 * page moves together.
 *
 * Gutters are 20px on a phone and grow to 32px from `sm` up, so content never
 * touches the screen edge on a 375px device.
 */

const widths = {
  /** Checkout card, forms. Must NOT stretch across a 1440px laptop. */
  narrow: "max-w-2xl",
  /** Ticket pages, focused admin detail views. */
  medium: "max-w-4xl",
  /** Landing page sections. */
  wide: "max-w-6xl",
  /** Admin tables, which genuinely need the room. */
  full: "max-w-[90rem]",
} as const;

export type ContainerWidth = keyof typeof widths;

type ContainerProps = {
  children: ReactNode;
  width?: ContainerWidth;
  /** Render as <section>, <main>, <header>… Defaults to <div>. */
  as?: ElementType;
  className?: string;
};

export function Container({
  children,
  width = "wide",
  as: Tag = "div",
  className,
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-5 sm:px-8", widths[width], className)}>
      {children}
    </Tag>
  );
}
