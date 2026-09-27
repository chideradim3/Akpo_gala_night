import { Badge, Card, CardBody } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/types/database";

/**
 * One admission ticket.
 *
 * Shaped like a physical ticket — a stub with the details, a perforation,
 * then the code panel. The notches and dashed rule are the one piece of
 * decoration on the page, and they are doing a job: they say "this is the
 * thing you hand over", which is what the guest is looking for while
 * standing in a queue.
 *
 * The QR is rendered white-on-white-background regardless of the dark
 * theme, because scanners need the contrast and a phone at low brightness
 * in a dim foyer needs all the help it can get.
 */

const STATUS: Record<TicketStatus, { label: string; tone: "success" | "neutral" | "danger" }> = {
  ACTIVE: { label: "Valid", tone: "success" },
  USED: { label: "Already used", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export function TicketCard({
  guestName,
  tierName,
  admits,
  ticketCode,
  status,
  checkedInAt,
  qrSvgMarkup,
}: {
  guestName: string;
  tierName: string;
  admits: number;
  ticketCode: string;
  status: TicketStatus;
  checkedInAt: string | null;
  qrSvgMarkup: string;
}) {
  const state = STATUS[status];
  const spent = status !== "ACTIVE";

  return (
    <Card as="li" className={cn("overflow-hidden", spent && "opacity-60")}>
      <CardBody className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-[var(--color-ink-muted)]">{tierName}</p>
            <p className="mt-1 truncate text-[length:var(--text-h3)] font-medium [font-family:var(--font-display)]">
              {guestName}
            </p>
          </div>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>

        <p className="text-sm text-[var(--color-accent-bright)]">
          {admits === 1 ? "Admits one guest" : `Admits ${admits} guests`}
        </p>
      </CardBody>

      {/* The perforation. Notches sit half outside the card so the dashed
          rule reads as a tear line rather than a divider. */}
      <div className="relative">
        <span
          aria-hidden
          className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-[var(--color-surface-page)]"
        />
        <span
          aria-hidden
          className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-[var(--color-surface-page)]"
        />
        <hr className="mx-4 border-0 border-t border-dashed border-[var(--color-line-strong)]" />
      </div>

      <CardBody className="space-y-4 p-5 text-center sm:p-6">
        <div
          className="mx-auto w-full max-w-[13rem] rounded-[var(--radius-control)] bg-white p-3"
          // Server-generated SVG from our own QR library — no user input
          // reaches this, only a random token we created.
          dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
        />

        <div>
          <p className="eyebrow text-[var(--color-ink-muted)]">Ticket code</p>
          <p className="tnum mt-1 text-xl font-semibold tracking-[0.12em]">{ticketCode}</p>
        </div>

        {checkedInAt && (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Used{" "}
            {new Intl.DateTimeFormat("en-NG", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Africa/Lagos",
            }).format(new Date(checkedInAt))}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
