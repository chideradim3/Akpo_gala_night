"use client";

import { useState, useTransition } from "react";

import {
  deleteTicketTypeAction,
  saveTicketTypeAction,
  setActiveAction,
  type SaveResult,
} from "@/app/admin/ticket-types/actions";
import { Badge, Button, Card, CardBody, ErrorMessage, Input, Textarea } from "@/components/ui";
import { formatNaira, koboToNaira } from "@/lib/money";
import type { AdminTicketType } from "@/lib/services/adminTicketTypes";

/**
 * Creating and editing ticket tiers.
 *
 * PRICES ARE ENTERED IN NAIRA. The form never handles kobo; the server
 * converts once, at the validation boundary. Asking an organiser to type
 * 20000000 for a ₦200,000 table would guarantee a costly typo.
 */

type Draft = {
  id?: string;
  name: string;
  description: string;
  priceNaira: string;
  admits: string;
  inventory: string;
  maxPerOrder: string;
  saleStart: string;
  saleEnd: string;
  sortOrder: string;
  isActive: boolean;
  /**
   * Carried through the form without being shown.
   *
   * There is no image input on this page yet, but the column exists and
   * the save action writes whatever it is given. Leaving the field out of
   * the payload entirely made every save fail validation, and defaulting
   * it to null here instead would erase an image that had been set some
   * other way. So it round-trips untouched.
   */
  imageUrl: string;
};

const BLANK: Draft = {
  name: "",
  description: "",
  priceNaira: "",
  admits: "1",
  inventory: "50",
  maxPerOrder: "10",
  saleStart: "",
  saleEnd: "",
  sortOrder: "0",
  isActive: true,
  imageUrl: "",
};

/** A timestamp from the database into what datetime-local expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDraft(tier: AdminTicketType): Draft {
  return {
    id: tier.id,
    name: tier.name,
    description: tier.description ?? "",
    priceNaira: String(koboToNaira(tier.priceKobo)),
    admits: String(tier.admits),
    inventory: String(tier.inventory),
    maxPerOrder: String(tier.maxPerOrder),
    saleStart: toLocalInput(tier.saleStart),
    saleEnd: toLocalInput(tier.saleEnd),
    sortOrder: String(tier.sortOrder),
    isActive: tier.isActive,
    imageUrl: tier.imageUrl ?? "",
  };
}

export function TicketTypeEditor({ tiers }: { tiers: AdminTicketType[] }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(work: () => Promise<SaveResult>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await work();
      setResult(outcome);
      if (outcome.ok) setEditing(null);
    });
  }

  function save() {
    if (!editing) return;
    run(() =>
      saveTicketTypeAction({
        id: editing.id,
        name: editing.name,
        description: editing.description,
        priceNaira: editing.priceNaira,
        admits: editing.admits,
        inventory: editing.inventory,
        maxPerOrder: editing.maxPerOrder,
        saleStart: editing.saleStart,
        saleEnd: editing.saleEnd,
        sortOrder: editing.sortOrder,
        isActive: editing.isActive,
        imageUrl: editing.imageUrl,
      }),
    );
  }

  const fieldError = (name: string) =>
    result && !result.ok ? result.fields?.[name] : undefined;

  /** The fields that actually have an input on this form. */
  const SHOWN = [
    "name",
    "description",
    "priceNaira",
    "admits",
    "inventory",
    "maxPerOrder",
    "saleStart",
    "saleEnd",
    "sortOrder",
  ];

  /**
   * Validation errors with nowhere to appear.
   *
   * "Please check the fields below" is useless when the field at fault has
   * no input — which is exactly what happened with imageUrl: every save
   * failed, and the page highlighted nothing. Surfacing the orphans turns a
   * dead end into something a person can report.
   */
  const orphanErrors =
    result && !result.ok && result.fields
      ? Object.entries(result.fields).filter(([key]) => !SHOWN.includes(key))
      : [];

  return (
    <div className="space-y-5">
      {result && (
        result.ok ? (
          <p className="rounded-[var(--radius-control)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-4 py-3 text-sm">
            {result.message}
          </p>
        ) : (
          <ErrorMessage title={result.message}>
            {orphanErrors.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {orphanErrors.map(([key, message]) => (
                  <li key={key}>
                    <code>{key}</code>: {message}
                  </li>
                ))}
              </ul>
            )}
          </ErrorMessage>
        )
      )}

      {!editing && (
        <Button onClick={() => setEditing({ ...BLANK })}>Add a ticket type</Button>
      )}

      {editing && (
        <Card selected>
          <CardBody className="space-y-5">
            <h2 className="text-[length:var(--text-h3)]">
              {editing.id ? `Edit ${editing.name || "ticket type"}` : "New ticket type"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="tt-name"
                label="Name"
                required
                value={editing.name}
                error={fieldError("name")}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <Input
                id="tt-price"
                label="Price (₦)"
                type="number"
                min="0"
                step="0.01"
                required
                hint="In Naira. 200000 means ₦200,000."
                value={editing.priceNaira}
                error={fieldError("priceNaira")}
                onChange={(e) => setEditing({ ...editing, priceNaira: e.target.value })}
              />
              <Input
                id="tt-admits"
                label="Admits"
                type="number"
                min="1"
                required
                hint="People per ticket. A table for ten is 10."
                value={editing.admits}
                error={fieldError("admits")}
                onChange={(e) => setEditing({ ...editing, admits: e.target.value })}
              />
              <Input
                id="tt-inventory"
                label="How many exist"
                type="number"
                min="0"
                required
                hint="Total, not remaining."
                value={editing.inventory}
                error={fieldError("inventory")}
                onChange={(e) => setEditing({ ...editing, inventory: e.target.value })}
              />
              <Input
                id="tt-max"
                label="Max per order"
                type="number"
                min="1"
                required
                value={editing.maxPerOrder}
                error={fieldError("maxPerOrder")}
                onChange={(e) => setEditing({ ...editing, maxPerOrder: e.target.value })}
              />
              <Input
                id="tt-sort"
                label="Sort order"
                type="number"
                min="0"
                hint="Lower numbers appear first."
                value={editing.sortOrder}
                error={fieldError("sortOrder")}
                onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })}
              />
              <Input
                id="tt-start"
                label="Sales open (optional)"
                type="datetime-local"
                value={editing.saleStart}
                error={fieldError("saleStart")}
                onChange={(e) => setEditing({ ...editing, saleStart: e.target.value })}
              />
              <Input
                id="tt-end"
                label="Sales close (optional)"
                type="datetime-local"
                value={editing.saleEnd}
                error={fieldError("saleEnd")}
                onChange={(e) => setEditing({ ...editing, saleEnd: e.target.value })}
              />
            </div>

            <Textarea
              id="tt-desc"
              label="Description"
              rows={2}
              value={editing.description}
              error={fieldError("description")}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                className="size-4 accent-[var(--color-accent)]"
              />
              On sale
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={save} loading={isPending} fullWidth>
                {editing.id ? "Save changes" : "Create"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <ul className="space-y-3">
        {tiers.map((tier) => (
          <li key={tier.id}>
            <Card className={tier.isActive ? undefined : "opacity-60"}>
              <CardBody className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{tier.name}</h3>
                      {!tier.isActive && <Badge>Off sale</Badge>}
                      {tier.sold > 0 && <Badge tone="accent">{tier.sold} sold</Badge>}
                    </div>
                    <p className="tnum mt-1 text-sm text-[var(--color-ink-secondary)]">
                      {formatNaira(tier.priceKobo)} · admits {tier.admits} · {tier.inventory} exist
                      · max {tier.maxPerOrder} per order
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(toDraft(tier))}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        run(() => setActiveAction({ id: tier.id, isActive: !tier.isActive }))
                      }
                    >
                      {tier.isActive ? "Take off sale" : "Put on sale"}
                    </Button>
                    {/* Delete only ever appears for a tier nobody has
                        ordered. The server refuses regardless. */}
                    {!tier.hasOrders && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isPending}
                        onClick={() => run(() => deleteTicketTypeAction(tier.id))}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {tier.hasOrders && (
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    This tier has orders against it, so it cannot be deleted — only taken off
                    sale. Deleting it would break tickets people already hold.
                  </p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
