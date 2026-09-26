import type { ReactNode, TextareaHTMLAttributes } from "react";

import { Field, controlClasses, describedBy } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export function Textarea({
  id,
  label,
  hint,
  error,
  required,
  rows = 4,
  className,
  wrapperClassName,
  ...rest
}: TextareaProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClasses, "resize-y py-3 leading-relaxed", className)}
        {...rest}
      />
    </Field>
  );
}
