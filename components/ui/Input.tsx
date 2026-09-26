import type { InputHTMLAttributes, ReactNode } from "react";

import { Field, controlClasses, describedBy } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export function Input({
  id,
  label,
  hint,
  error,
  required,
  className,
  wrapperClassName,
  ...rest
}: InputProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClasses, "h-12", className)}
        {...rest}
      />
    </Field>
  );
}
