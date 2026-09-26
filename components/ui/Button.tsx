import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

/**
 * The site's button, in two forms:
 *
 *   <Button>        — performs an action (submit, open, confirm)
 *   <ButtonLink>    — navigates somewhere
 *
 * They look identical but render different elements. Never nest a link inside
 * a button to get a navigating button: that is invalid HTML and breaks
 * keyboard and screen-reader behaviour.
 *
 * `primary` is a white pill with black text — the strongest thing on a black
 * page, and what the reference checkout uses for its main call to action.
 * `accent` is the purple variant, for a second action beside a primary one.
 * `ghost` is tertiary/back actions. `danger` is admin-only.
 */

const variants = {
  primary:
    "bg-white text-[var(--color-ink-inverse)] hover:bg-white/90 active:bg-white/80",
  accent:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-bright)] " +
    "shadow-[var(--shadow-glow-soft)]",
  ghost:
    "bg-white/[0.04] text-[var(--color-ink)] border border-[var(--color-line)] " +
    "hover:bg-white/[0.08] hover:border-[var(--color-line-strong)]",
  danger: "bg-[var(--color-danger)] text-white hover:brightness-110",
} as const;

const sizes = {
  // min-h keeps every button a comfortable touch target on a phone. 44px is
  // the accessibility floor; `md` and `lg` clear it.
  sm: "min-h-9 px-4 text-sm gap-2",
  md: "min-h-11 px-6 text-sm gap-2.5",
  lg: "min-h-14 px-8 text-base gap-3",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

/** Shared appearance, so Button and ButtonLink can never drift apart. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-[var(--radius-pill)]",
    "font-semibold tracking-[0.08em] uppercase whitespace-nowrap",
    "transition-[background-color,border-color,opacity,filter] duration-200",
    "[transition-timing-function:var(--ease-out-soft)]",
    "disabled:cursor-not-allowed disabled:opacity-45",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks. Use for in-flight server actions. */
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({
  variant,
  size,
  loading = false,
  fullWidth,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner size="sm" label="" />}
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
};

export function ButtonLink({
  href,
  variant,
  size,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
