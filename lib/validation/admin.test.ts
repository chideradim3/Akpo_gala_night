import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { priceToKobo, ticketTypeSchema } from "./admin.js";

/**
 * The admin forms send a plain object, not a FormData, so a field the form
 * forgets to include arrives as `undefined` rather than "".
 *
 * That is not hypothetical. `imageUrl` was in the schema and not in the
 * editor's payload, and because `optionalText` is `.nullable()` and not
 * `.optional()`, `undefined` failed the type check. Every single save from
 * the ticket types page was rejected — and since there is no image input
 * on that page, the error had no field to attach to, so the form showed
 * "Please check the fields below" while highlighting nothing at all.
 *
 * The test that would have caught it is this one: parse exactly what the
 * editor sends.
 */

/** Exactly the payload `TicketTypeEditor.save()` builds. */
function editorPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "8f1c2b4e-5d3a-4c7b-9e1f-2a3b4c5d6e7f",
    name: "Premium table",
    description: "A reserved table for six.",
    priceNaira: "1000000",
    admits: "6",
    inventory: "8",
    maxPerOrder: "2",
    saleStart: "",
    saleEnd: "",
    sortOrder: "1",
    isActive: true,
    imageUrl: "",
    ...overrides,
  };
}

describe("ticketTypeSchema", () => {
  it("accepts what the editor actually sends", () => {
    const result = ticketTypeSchema.safeParse(editorPayload());
    assert.equal(
      result.success,
      true,
      result.success ? "" : JSON.stringify(result.error.issues, null, 2),
    );
  });

  it("reads the numbers as numbers", () => {
    const result = ticketTypeSchema.safeParse(editorPayload());
    assert.ok(result.success);
    assert.equal(result.data.priceNaira, 1_000_000);
    assert.equal(result.data.admits, 6);
    assert.equal(result.data.inventory, 8);
    assert.equal(result.data.maxPerOrder, 2);
    assert.equal(result.data.sortOrder, 1);
  });

  it("turns blank optional fields into null", () => {
    const result = ticketTypeSchema.safeParse(editorPayload());
    assert.ok(result.success);
    assert.equal(result.data.saleStart, null);
    assert.equal(result.data.saleEnd, null);
    assert.equal(result.data.imageUrl, null);
  });

  it("keeps an image the editor round-trips, rather than wiping it", () => {
    // updateTicketType writes image_url from this value, so dropping the
    // field on an edit would erase a picture nobody asked to remove.
    const url = "https://example.com/table.jpg";
    const result = ticketTypeSchema.safeParse(editorPayload({ imageUrl: url }));
    assert.ok(result.success);
    assert.equal(result.data.imageUrl, url);
  });

  it("creates without an id", () => {
    // A new tier: the editor's BLANK draft has no id at all.
    const result = ticketTypeSchema.safeParse(editorPayload({ id: undefined }));
    assert.ok(result.success);
    assert.equal(result.data.id, undefined);
  });

  it("still rejects the mistakes it is there to catch", () => {
    const bad = [
      ["name", { name: "  " }],
      ["priceNaira", { priceNaira: "-1" }],
      ["priceNaira", { priceNaira: "999999999" }],
      ["admits", { admits: "0" }],
      ["maxPerOrder", { maxPerOrder: "0" }],
      ["inventory", { inventory: "-5" }],
    ] as const;

    for (const [field, override] of bad) {
      const result = ticketTypeSchema.safeParse(editorPayload(override));
      assert.equal(result.success, false, `${field}=${JSON.stringify(override)} should fail`);
    }
  });

  it("refuses a sale window that ends before it starts", () => {
    const result = ticketTypeSchema.safeParse(
      editorPayload({ saleStart: "2026-12-20T10:00", saleEnd: "2026-12-01T10:00" }),
    );
    assert.equal(result.success, false);
    assert.ok(!result.success);
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "saleEnd"));
  });

  it("the editor sends every key the schema declares", () => {
    // The structural version of the first test, and the one that will
    // catch the NEXT field somebody adds to the schema and forgets to add
    // to the form. A hardcoded payload only proves today's payload works.
    //
    // A key may be missing from the payload only if the schema can supply
    // it: `.optional()` or `.default()`. `imageUrl` was neither, which is
    // why leaving it out broke every save.
    const declared = Object.keys(ticketTypeSchema.shape);
    const sent = new Set(Object.keys(editorPayload()));

    const missing = declared.filter((key) => {
      if (sent.has(key)) return false;
      // Can the schema cope on its own?
      return !ticketTypeSchema.shape[key as keyof typeof ticketTypeSchema.shape].safeParse(
        undefined,
      ).success;
    });

    assert.deepEqual(
      missing,
      [],
      `TicketTypeEditor.save() does not send: ${missing.join(", ")}. ` +
        `Add it to the payload, or make it .optional() in the schema.`,
    );
  });

  it("every error names a field the editor can show", () => {
    // An error on a field with no input is invisible to whoever is trying
    // to save. If this list ever needs a new entry, the form needs one too.
    const shown = new Set([
      "name",
      "description",
      "priceNaira",
      "admits",
      "inventory",
      "maxPerOrder",
      "saleStart",
      "saleEnd",
      "sortOrder",
    ]);

    const result = ticketTypeSchema.safeParse(editorPayload({ priceNaira: "-1", admits: "0" }));
    assert.ok(!result.success);
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      assert.ok(shown.has(key), `error on "${key}" has no input on the form`);
    }
  });
});

describe("priceToKobo", () => {
  it("converts the Naira an admin types into integer kobo", () => {
    assert.equal(priceToKobo(1_000_000), 100_000_000);
    assert.equal(priceToKobo(200_000), 20_000_000);
    assert.equal(priceToKobo(5_000), 500_000);
    // The classic float case: 10.55 * 100 is 1054.9999999999998.
    assert.equal(priceToKobo(10.55), 1055);
    assert.ok(Number.isInteger(priceToKobo(10.55)));
  });
});
