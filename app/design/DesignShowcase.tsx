"use client";

import { useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Container,
  DataList,
  EmptyState,
  ErrorMessage,
  Input,
  QuantitySelector,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Stepper,
  Textarea,
  type Column,
} from "@/components/ui";
import { formatNaira, kobo } from "@/lib/money";

/* ── Helpers used only by this page ──────────────────────────────────── */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 border-t border-[var(--color-line)] pt-10">
      <div className="space-y-1">
        <h2 className="text-[length:var(--text-h3)] font-semibold">{title}</h2>
        {note && <p className="max-w-2xl text-sm text-[var(--color-ink-muted)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="space-y-2">
      <div
        className="h-16 rounded-[var(--radius-control)] border border-[var(--color-line)]"
        style={{ background: `var(${cssVar})` }}
      />
      <p className="text-xs text-[var(--color-ink-secondary)]">{name}</p>
      <p className="text-[0.625rem] break-all text-[var(--color-ink-muted)]">{cssVar}</p>
    </div>
  );
}

/* ── Sample rows for the DataList demo ───────────────────────────────── */

type DemoOrder = { reference: string; email: string; total: number; status: string };

const demoOrders: DemoOrder[] = [
  { reference: "GALA-1042", email: "ada@example.com", total: 20_000_000, status: "PAID" },
  { reference: "GALA-1043", email: "chidi@example.com", total: 1_000_000, status: "PENDING" },
  { reference: "GALA-1044", email: "ngozi@example.com", total: 500_000, status: "EXPIRED" },
];

const orderColumns: Column<DemoOrder>[] = [
  { key: "reference", header: "Reference", cell: (o) => o.reference, hideOnCard: true },
  { key: "email", header: "Email", cell: (o) => o.email, hideOnCard: true },
  { key: "total", header: "Total", align: "right", cell: (o) => formatNaira(kobo(o.total)) },
  {
    key: "status",
    header: "Status",
    cell: (o) => (
      <Badge tone={o.status === "PAID" ? "success" : o.status === "PENDING" ? "warning" : "neutral"}>
        {o.status}
      </Badge>
    ),
  },
];

/* ── The page ────────────────────────────────────────────────────────── */

export function DesignShowcase() {
  const [quantity, setQuantity] = useState(1);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState(2);

  return (
    <main id="main" className="py-14 sm:py-20">
      <Container width="wide" className="space-y-12">
        <header className="space-y-3">
          <Badge tone="accent">Development only · 404s in production</Badge>
          <h1 className="text-[length:var(--text-h1)] font-bold">Design system</h1>
          <p className="max-w-2xl text-[length:var(--text-body-lg)] text-[var(--color-ink-secondary)]">
            Every primitive in every state. Resize the window through 375, 390, 430, 768, 1024,
            1440 and 1920px — nothing should scroll horizontally or stretch edge to edge.
          </p>
        </header>

        <Section title="Colour" note="One accent. Status colours are for admin and check-in only.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <Swatch name="Page" cssVar="--color-surface-page" />
            <Swatch name="Raised" cssVar="--color-surface-raised" />
            <Swatch name="Overlay" cssVar="--color-surface-overlay" />
            <Swatch name="Accent" cssVar="--color-accent" />
            <Swatch name="Accent bright" cssVar="--color-accent-bright" />
            <Swatch name="Accent deep" cssVar="--color-accent-deep" />
            <Swatch name="Success" cssVar="--color-success" />
            <Swatch name="Danger" cssVar="--color-danger" />
            <Swatch name="Warning" cssVar="--color-warning" />
          </div>
        </Section>

        <Section
          title="Typography"
          note="Every size is clamp()-based, so these shrink and grow with the viewport without a single mobile override anywhere in the app."
        >
          <div className="space-y-5">
            <p className="text-[length:var(--text-display)] font-bold [font-family:var(--font-display)]">
              Gala Night
            </p>
            <h3 className="text-[length:var(--text-h1)] font-bold">Heading one</h3>
            <h3 className="text-[length:var(--text-h2)] font-semibold">Heading two</h3>
            <h3 className="text-[length:var(--text-h3)] font-semibold">Heading three</h3>
            <p className="max-w-2xl text-[length:var(--text-body-lg)] text-[var(--color-ink-secondary)]">
              Body large — an evening of fine dining, live music and celebration.
            </p>
            <p className="max-w-2xl text-sm text-[var(--color-ink-muted)]">
              Small print, used for hints and captions.
            </p>
            <p className="eyebrow text-[var(--color-ink-muted)]">Eyebrow label</p>
            <p className="tnum text-[length:var(--text-amount)] font-bold">
              {formatNaira(kobo(20_000_000))}
            </p>
          </div>
        </Section>

        <Section title="Buttons" note="Minimum 44px tall from size md up.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <ButtonLink href="/design" variant="ghost">
                Button link
              </ButtonLink>
            </div>
            <Button fullWidth size="lg">
              Full width (mobile checkout CTA)
            </Button>
          </div>
        </Section>

        <Section
          title="Stepper"
          note="The checkout progress indicator. Labels shrink rather than truncate on a phone."
        >
          <Card>
            <CardBody className="space-y-6">
              <Stepper
                current={step}
                steps={[{ label: "Your details" }, { label: "Select tickets" }, { label: "Payment" }]}
              />
              <div className="flex justify-center gap-2">
                {[1, 2, 3].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={step === n ? "accent" : "ghost"}
                    onClick={() => setStep(n)}
                  >
                    Step {n}
                  </Button>
                ))}
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section
          title="Cards"
          note="The selected state is what a ticket tier looks like once a quantity is chosen."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardBody>
                <CardHeader title="Default card" subtitle="Hairline border, no glow." />
              </CardBody>
            </Card>
            <Card selected>
              <CardBody>
                <CardHeader title="Selected card" subtitle="Accent edge bar and glow." />
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section
          title="Ticket tier row"
          note="Card + QuantitySelector. This is the shape checkout step 2 uses in Phase 4."
        >
          <div className="space-y-3">
            <Card selected={quantity > 0}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-base font-semibold">VIP table</p>
                  <p className="tnum text-sm text-[var(--color-ink-secondary)]">
                    {formatNaira(kobo(20_000_000))} · admits 10
                  </p>
                </div>
                <QuantitySelector label="VIP table" value={quantity} onChange={setQuantity} max={3} />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-base font-semibold">Standard</p>
                  <p className="tnum text-sm text-[var(--color-ink-secondary)]">
                    {formatNaira(kobo(500_000))} · admits 1
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>Sold out</Badge>
                  <QuantitySelector label="Standard" value={0} onChange={() => {}} disabled />
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section
          title="Form controls"
          note="Labels, hints, errors and focus rings are wired up for screen readers."
        >
          <Card>
            <CardBody className="grid gap-5 md:grid-cols-2">
              <Input
                id="demo-email"
                label="Email address"
                type="email"
                placeholder="you@example.com"
                required
              />
              <Input
                id="demo-phone"
                label="Phone number"
                placeholder="08012345678 or +234…"
                hint="Nigerian mobile number, at least 11 digits."
              />
              <Input id="demo-error" label="First name" error="Please enter your first name." />
              <Input id="demo-disabled" label="Reference" defaultValue="GALA-1042" disabled />
              <Select id="demo-select" label="Order status" defaultValue="PAID">
                <option>PENDING</option>
                <option>PAID</option>
                <option>FAILED</option>
              </Select>
              <Textarea
                id="demo-textarea"
                label="Description"
                placeholder="A reserved table for ten…"
              />
              <div className="md:col-span-2">
                <Checkbox
                  id="demo-consent"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  label={
                    <>
                      I agree to the processing of my personal data in line with the{" "}
                      <span className="text-[var(--color-accent-bright)] underline">
                        privacy policy
                      </span>{" "}
                      (Nigeria Data Protection Act).
                    </>
                  }
                />
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2.5">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Paid</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger">Failed</Badge>
          </div>
        </Section>

        <Section title="Loading and feedback">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardBody className="space-y-4">
                <div className="flex items-center gap-4">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                </div>
                <Skeleton className="h-11 w-full" />
                <SkeletonText lines={3} />
              </CardBody>
            </Card>
            <div className="space-y-4">
              <ErrorMessage title="That tier just sold out">
                Someone bought the last VIP table while you were choosing. Please pick another tier.
              </ErrorMessage>
              <EmptyState
                title="No orders yet"
                description="Orders will appear here as soon as the first ticket is bought."
                action={
                  <Button size="sm" variant="ghost">
                    Refresh
                  </Button>
                }
              />
            </div>
          </div>
        </Section>

        <Section
          title="DataList"
          note="Below 1024px this is a stack of cards; at 1024px and up it becomes a table. Same data, one column definition. Resize to watch it switch."
        >
          <DataList
            rows={demoOrders}
            columns={orderColumns}
            getRowKey={(order) => order.reference}
            cardTitle={(order) => order.reference}
            cardSubtitle={(order) => order.email}
            caption="Sample orders"
          />
        </Section>

        <Section
          title="Container widths"
          note="Every page uses one of these. Note how narrow stays readable instead of stretching on a wide screen."
        >
          <div className="space-y-3">
            {(["narrow", "medium", "wide", "full"] as const).map((width) => (
              <Container
                key={width}
                width={width}
                className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-accent-line)] py-3 text-center text-xs text-[var(--color-ink-secondary)]"
              >
                {width}
              </Container>
            ))}
          </div>
        </Section>
      </Container>
    </main>
  );
}
