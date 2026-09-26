import type { ReactNode, SelectHTMLAttributes } from "react";

import { Field, controlClasses, describedBy } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
  children: ReactNode;
};

export function Select({
  id,
  label,
  hint,
  error,
  required,
  className,
  wrapperClassName,
  children,
  ...rest
}: SelectProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlClasses, "h-12 appearance-none pr-11", className)}
          {...rest}
        >
          {children}
        </select>
        {/* Chevron, drawn inline so we do not pull in an icon package. */}
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Field>
  );
}
