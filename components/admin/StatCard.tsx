import type { ReactNode } from "react";

import { Card, CardBody } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * One headline number.
 *
 * The value is set in the display face at a large size, with a quiet label
 * above and an optional line of context below. The context line is where
 * the honesty lives: "₦450,000" means little without "from 12 paid orders".
 */
export function StatCard({
  label,
  value,
  context,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  tone?: "default" | "accent" | "warning";
}) {
  return (
    <Card selected={tone === "accent"}>
      <CardBody className="space-y-1.5 p-5">
        <p className="eyebrow text-[var(--color-ink-muted)]">{label}</p>
        <p
          className={cn(
            "tnum text-[length:var(--text-h2)] leading-none font-semibold [font-family:var(--font-display)]",
            tone === "warning" && "text-[var(--color-warning)]",
          )}
        >
          {value}
        </p>
        {context && <p className="text-sm text-[var(--color-ink-secondary)]">{context}</p>}
      </CardBody>
    </Card>
  );
}
