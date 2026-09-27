"use client";

import { useState, useTransition } from "react";

import { saveEventAction, type EventSaveResult } from "@/app/admin/event/actions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ErrorMessage,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { EventRow, ExperienceEntry, FaqEntry } from "@/types/database";

/**
 * Editing everything the public site says.
 *
 * Grouped the way an organiser thinks about it — the basics, when and
 * where, the words, the running order, the questions — rather than in
 * database column order.
 *
 * The repeatable sections (running order, FAQ) are plain arrays in local
 * state with add and remove buttons. No drag-and-drop: it is fiddly on a
 * phone, hard to make accessible, and reordering a five-item list is not
 * the problem worth solving here.
 */

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
function asFaq(value: unknown): FaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const e = entry as Record<string, unknown>;
    return typeof e.question === "string" && typeof e.answer === "string"
      ? [{ question: e.question, answer: e.answer }]
      : [];
  });
}
function asExperience(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.title !== "string") return [];
    return [
      {
        title: e.title,
        time: typeof e.time === "string" ? e.time : "",
        description: typeof e.description === "string" ? e.description : "",
      },
    ];
  });
}

export function EventSettingsForm({ event }: { event: EventRow }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<EventSaveResult | null>(null);

  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    about: event.about ?? "",
    date: event.date,
    startTime: event.start_time?.slice(0, 5) ?? "",
    endTime: event.end_time?.slice(0, 5) ?? "",
    venue: event.venue ?? "",
    address: event.address ?? "",
    dressCode: event.dress_code ?? "",
    heroImageUrl: event.hero_image_url ?? "",
    contactEmail: event.contact_email ?? "",
    contactPhone: event.contact_phone ?? "",
    status: event.status,
  });

  const [gallery, setGallery] = useState<string[]>(asStringArray(event.gallery));
  const [faq, setFaq] = useState<FaqEntry[]>(asFaq(event.faq));
  const [experience, setExperience] = useState<ExperienceEntry[]>(asExperience(event.experience));

  const err = (name: string) => (result && !result.ok ? result.fields?.[name] : undefined);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  function save() {
    setResult(null);
    startTransition(async () => {
      const outcome = await saveEventAction({
        ...form,
        gallery: gallery.filter((url) => url.trim() !== ""),
        faq: faq.filter((entry) => entry.question.trim() && entry.answer.trim()),
        experience: experience.filter((entry) => entry.title.trim()),
      });
      setResult(outcome);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="space-y-6">
      {result &&
        (result.ok ? (
          <p className="rounded-[var(--radius-control)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-4 py-3 text-sm">
            {result.message}
          </p>
        ) : (
          <ErrorMessage title={result.message} />
        ))}

      <Card>
        <CardBody className="space-y-5">
          <h2 className="text-[length:var(--text-h3)]">The basics</h2>
          <Input
            id="ev-name"
            label="Event name"
            required
            value={form.name}
            error={err("name")}
            onChange={(e) => set({ name: e.target.value })}
          />
          <Textarea
            id="ev-desc"
            label="Short description"
            rows={2}
            hint="One or two lines. Appears under the name on the hero and in the ticket email."
            value={form.description}
            error={err("description")}
            onChange={(e) => set({ description: e.target.value })}
          />
          <Select
            id="ev-status"
            label="Status"
            value={form.status}
            hint="Only a PUBLISHED event is visible to the public. Drafts are invisible to everyone but you."
            onChange={(e) => set({ status: e.target.value as typeof form.status })}
          >
            <option value="DRAFT">Draft — hidden from the public</option>
            <option value="PUBLISHED">Published — live on the site</option>
            <option value="ARCHIVED">Archived — finished</option>
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <h2 className="text-[length:var(--text-h3)]">When and where</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="ev-date"
              label="Date"
              type="date"
              required
              value={form.date}
              error={err("date")}
              onChange={(e) => set({ date: e.target.value })}
            />
            <Input
              id="ev-start"
              label="Doors"
              type="time"
              value={form.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
            />
            <Input
              id="ev-end"
              label="Ends"
              type="time"
              value={form.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
            />
          </div>
          <Input
            id="ev-venue"
            label="Venue"
            value={form.venue}
            onChange={(e) => set({ venue: e.target.value })}
          />
          <Input
            id="ev-address"
            label="Address"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
          />
          <Input
            id="ev-dress"
            label="Dress code"
            hint="Shown in its own panel. Leave blank to hide that section."
            value={form.dressCode}
            onChange={(e) => set({ dressCode: e.target.value })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <h2 className="text-[length:var(--text-h3)]">About</h2>
          <Textarea
            id="ev-about"
            label="About this event"
            rows={6}
            hint="Leave a blank line between paragraphs. Blank hides the section entirely."
            value={form.about}
            onChange={(e) => set({ about: e.target.value })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[length:var(--text-h3)]">The evening</h2>
            <Badge>{experience.length} entries</Badge>
          </div>
          <p className="text-sm text-[var(--color-ink-secondary)]">
            The running order. Times are free text — &ldquo;7:00 PM&rdquo;, &ldquo;Midnight&rdquo;,
            &ldquo;Till late&rdquo;. Remove them all and it becomes a plain list.
          </p>

          {experience.map((entry, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-[var(--radius-control)] border border-[var(--color-line)] p-4 sm:grid-cols-[8rem_1fr_auto]"
            >
              <Input
                id={`exp-time-${index}`}
                label="Time"
                placeholder="7:00 PM"
                value={entry.time ?? ""}
                onChange={(e) => {
                  const next = [...experience];
                  next[index] = { ...entry, time: e.target.value };
                  setExperience(next);
                }}
              />
              <div className="space-y-3">
                <Input
                  id={`exp-title-${index}`}
                  label="What happens"
                  value={entry.title}
                  onChange={(e) => {
                    const next = [...experience];
                    next[index] = { ...entry, title: e.target.value };
                    setExperience(next);
                  }}
                />
                <Input
                  id={`exp-desc-${index}`}
                  label="Detail (optional)"
                  value={entry.description ?? ""}
                  onChange={(e) => {
                    const next = [...experience];
                    next[index] = { ...entry, description: e.target.value };
                    setExperience(next);
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-end"
                onClick={() => setExperience(experience.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            onClick={() => setExperience([...experience, { time: "", title: "", description: "" }])}
          >
            Add to the evening
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[length:var(--text-h3)]">Questions</h2>
            <Badge>{faq.length} entries</Badge>
          </div>

          {faq.map((entry, index) => (
            <div
              key={index}
              className="space-y-3 rounded-[var(--radius-control)] border border-[var(--color-line)] p-4"
            >
              <Input
                id={`faq-q-${index}`}
                label="Question"
                value={entry.question}
                onChange={(e) => {
                  const next = [...faq];
                  next[index] = { ...entry, question: e.target.value };
                  setFaq(next);
                }}
              />
              <Textarea
                id={`faq-a-${index}`}
                label="Answer"
                rows={2}
                value={entry.answer}
                onChange={(e) => {
                  const next = [...faq];
                  next[index] = { ...entry, answer: e.target.value };
                  setFaq(next);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFaq(faq.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}

          <Button variant="ghost" onClick={() => setFaq([...faq, { question: "", answer: "" }])}>
            Add a question
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <h2 className="text-[length:var(--text-h3)]">Contact</h2>
          <Input
            id="ev-email"
            label="Contact email"
            type="email"
            value={form.contactEmail}
            error={err("contactEmail")}
            onChange={(e) => set({ contactEmail: e.target.value })}
          />
          <Input
            id="ev-phone"
            label="Contact phone"
            value={form.contactPhone}
            onChange={(e) => set({ contactPhone: e.target.value })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-[length:var(--text-h3)]">Images</h2>
          <Input
            id="ev-hero"
            label="Hero image URL"
            placeholder="https://…"
            hint="Optional. The page is designed to work without one."
            value={form.heroImageUrl}
            onChange={(e) => set({ heroImageUrl: e.target.value })}
          />

          <div className="space-y-3">
            <p className="text-sm font-medium">Gallery</p>
            {gallery.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input
                  aria-label={`Gallery image ${index + 1}`}
                  value={url}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = [...gallery];
                    next[index] = e.target.value;
                    setGallery(next);
                  }}
                  className="h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-inset)] px-4 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGallery(gallery.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setGallery([...gallery, ""])}>
              Add an image
            </Button>
            <p className="text-xs text-[var(--color-ink-muted)]">
              The gallery section hides itself when empty, so an event with no photographs still
              looks finished.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Sticky so the organiser can save from anywhere in a long form
          rather than scrolling to the bottom each time. */}
      <div className="sticky bottom-4 z-10">
        <Card selected>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-[var(--color-ink-secondary)]">
              {form.status === "PUBLISHED" ? "Changes go live immediately." : "This event is not published."}
            </p>
            <Button onClick={save} loading={isPending}>
              Save changes
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
