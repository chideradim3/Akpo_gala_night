import type { ReactNode } from "react";

import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

/**
 * One dataset, two layouts.
 *
 * A data table is the right shape for orders and attendees on a laptop, and
 * completely unusable on a 375px phone — it either overflows the viewport or
 * shrinks the text to nothing. So this component renders:
 *
 *   below `lg` : one Card per row, each column as a label/value pair
 *   `lg` and up: a real <table> with a sticky header
 *
 * Every admin screen in Phases 7–9 uses this, which is why those screens are
 * responsive by default instead of each one re-solving the same problem.
 *
 * Both layouts come from the SAME `columns` definition, so they can never
 * drift apart.
 */

export type Column<T> = {
  /** Stable key for React and for the mobile label. */
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /**
   * Omit this column from the mobile card — use it when the value is already
   * in `cardTitle` and repeating it would be noise.
   */
  hideOnCard?: boolean;
  /** Right-align numbers and money in the table. */
  align?: "left" | "right";
  className?: string;
};

type DataListProps<T> = {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  /** Headline for each mobile card, e.g. the order reference. */
  cardTitle?: (row: T) => ReactNode;
  /** Secondary line under the mobile card title, e.g. the buyer's email. */
  cardSubtitle?: (row: T) => ReactNode;
  /** Screen-reader description of the table. */
  caption: string;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  className?: string;
};

export function DataList<T>({
  rows,
  columns,
  getRowKey,
  cardTitle,
  cardSubtitle,
  caption,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  className,
}: DataListProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className={className} />;
  }

  const cardColumns = columns.filter((column) => !column.hideOnCard);

  return (
    <div className={className}>
      {/* ── Phone / tablet: stacked cards ───────────────────────────────── */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)}>
            <Card>
              <CardBody className="space-y-3 p-4 sm:p-5">
                {cardTitle && (
                  <div className="space-y-0.5">
                    <p className="text-base font-semibold">{cardTitle(row)}</p>
                    {cardSubtitle && (
                      <p className="text-sm text-[var(--color-ink-secondary)]">
                        {cardSubtitle(row)}
                      </p>
                    )}
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {cardColumns.map((column) => (
                    <div key={column.key} className="min-w-0 space-y-0.5">
                      <dt className="eyebrow text-[var(--color-ink-muted)]">{column.header}</dt>
                      <dd className="truncate text-sm">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      {/* ── Laptop and up: a real table ─────────────────────────────────── */}
      <div
        className={cn(
          "hidden overflow-x-auto rounded-[var(--radius-card)] lg:block",
          "border border-[var(--color-line)] bg-[var(--color-surface-raised)]",
        )}
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-overlay)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "eyebrow border-b border-[var(--color-line)] px-4 py-3.5",
                    "whitespace-nowrap text-[var(--color-ink-muted)]",
                    column.align === "right" && "text-right",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-[var(--color-line)] transition-colors last:border-b-0 hover:bg-white/[0.025]"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3.5 align-middle",
                      column.align === "right" && "tnum text-right",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
