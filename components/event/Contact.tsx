import { Section } from "@/components/event/Section";
import { formatVenue, telHref } from "@/lib/formatEvent";
import type { GalaEvent } from "@/lib/services/events";

/**
 * Contact details, plus the recovery route for someone who has lost their
 * ticket email — which is the single most common reason a buyer comes back
 * to the site after paying.
 */

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="grid gap-1 border-t border-[var(--color-line)] py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
      <dt className="eyebrow pt-1 text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="break-words text-[length:var(--text-body-lg)]">
        {href ? (
          <a
            href={href}
            className="underline decoration-[var(--color-accent-line)] underline-offset-4 transition-colors hover:text-[var(--color-accent-bright)] hover:decoration-[var(--color-accent)]"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function Contact({ event }: { event: GalaEvent }) {
  const venue = formatVenue(event);

  const rows = [
    event.contactEmail
      ? { label: "Email", value: event.contactEmail, href: `mailto:${event.contactEmail}` }
      : null,
    event.contactPhone
      ? { label: "Phone", value: event.contactPhone, href: telHref(event.contactPhone) }
      : null,
    venue ? { label: "Venue", value: venue } : null,
    { label: "Lost tickets", value: "Have them sent to your email again", href: "/find-tickets" },
  ].filter((row): row is { label: string; value: string; href?: string } => row !== null);

  return (
    <Section id="contact" eyebrow="Contact" title="Get in touch">
      <dl className="max-w-3xl border-b border-[var(--color-line)] lg:pl-[10rem]">
        {rows.map((row) => (
          <ContactRow key={row.label} {...row} />
        ))}
      </dl>
    </Section>
  );
}
