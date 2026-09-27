import { Card, CardBody, EmptyState } from "@/components/ui";
import { formatNaira, kobo, sumKobo } from "@/lib/money";
import type { SalesDay } from "@/lib/services/adminMetrics";

/**
 * Revenue per day, drawn as inline SVG.
 *
 * Hand-rolled rather than pulling in a charting library: this is one series
 * of bars, and a chart package would be the largest dependency in the
 * project by a wide margin for the sake of it (spec §2 — avoid unnecessary
 * dependencies).
 *
 * Being SVG it is rendered on the server, so it costs the browser nothing
 * and appears with the page rather than after it.
 *
 * The figures are also given as a table below, visually hidden. A bar chart
 * is meaningless to a screen reader, and "how much did we take on
 * Saturday?" deserves a real answer rather than "graphic".
 */
export function SalesChart({ days }: { days: SalesDay[] }) {
  if (days.length === 0) {
    return (
      <EmptyState
        title="No sales yet"
        description="Once tickets start selling, daily revenue appears here."
      />
    );
  }

  // kobo() rather than a cast: it re-checks the value is a whole,
  // non-negative integer, which is the whole point of the branded type.
  const peak = kobo(Math.max(...days.map((day) => day.revenueKobo), 1));
  const total = sumKobo(...days.map((day) => day.revenueKobo));
  const width = 100;
  const height = 34;
  const gap = days.length > 1 ? 1.5 : 0;
  const barWidth = (width - gap * (days.length - 1)) / days.length;

  const label = (iso: string) =>
    new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })
      .format(new Date(`${iso}T12:00:00Z`));

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[length:var(--text-h3)]">Revenue per day</h2>
          <p className="tnum text-sm text-[var(--color-ink-muted)]">
            peak {formatNaira(peak)}
          </p>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Bar chart of revenue per day. The figures follow in a table."
          className="h-40 w-full sm:h-52"
        >
          {days.map((day, index) => {
            // Minimum 0.6 so a small but real day is still visible rather
            // than rounding away to an empty column.
            const barHeight = Math.max((day.revenueKobo / peak) * height, 0.6);
            return (
              <rect
                key={day.date}
                x={index * (barWidth + gap)}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={0.6}
                fill="var(--color-accent)"
                opacity={0.85}
              >
                <title>{`${label(day.date)}: ${formatNaira(day.revenueKobo)} from ${day.orders} order${day.orders === 1 ? "" : "s"}`}</title>
              </rect>
            );
          })}
        </svg>

        {/* Only the ends are labelled: with many days, every label becomes
            unreadable overlapping text. */}
        <div className="flex justify-between text-xs text-[var(--color-ink-muted)]">
          <span>{label(days[0].date)}</span>
          {days.length > 1 && <span>{label(days[days.length - 1].date)}</span>}
        </div>

        <table className="sr-only">
          <caption>Revenue per day</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Orders</th>
              <th scope="col">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{label(day.date)}</th>
                <td>{day.orders}</td>
                <td>{formatNaira(day.revenueKobo)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs text-[var(--color-ink-muted)]">
          Total {formatNaira(total)} across {days.length}{" "}
          {days.length === 1 ? "day" : "days"} · paid orders only
        </p>
      </CardBody>
    </Card>
  );
}
