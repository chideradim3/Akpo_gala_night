import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOrderSchema, fieldErrors, guestDetailsSchema } from "./checkout.js";

/**
 * These test the boundary between the browser and everything else.
 *
 * Every one of them is a thing a tampered page, a broken client or a
 * careless typo could send, and the question is always the same: does the
 * server refuse it?
 */

const VALID_DETAILS = {
  email: "Ada@Example.com",
  firstName: "Ada",
  lastName: "Obi",
  phone: "08012345678",
  consent: true as const,
};

const TIER_A = "5a000000-0000-4000-8000-000000000101";
const TIER_B = "5a000000-0000-4000-8000-000000000103";

describe("guestDetailsSchema", () => {
  it("accepts good details and normalises them", () => {
    const result = guestDetailsSchema.parse(VALID_DETAILS);
    // Lower-cased so one person is one attendee row however they type it.
    assert.equal(result.email, "ada@example.com");
    // Stored in the one format the database accepts.
    assert.equal(result.phone, "+2348012345678");
  });

  it("trims whitespace rather than storing it", () => {
    const result = guestDetailsSchema.parse({ ...VALID_DETAILS, firstName: "  Ada  " });
    assert.equal(result.firstName, "Ada");
  });

  it("rejects an unticked consent box", () => {
    // The NDPA consent must be a positive act. `false` has to fail, not pass
    // through as a stored value of false.
    const result = guestDetailsSchema.safeParse({ ...VALID_DETAILS, consent: false });
    assert.equal(result.success, false);
  });

  it("rejects a missing consent field entirely", () => {
    const { consent, ...withoutConsent } = VALID_DETAILS;
    void consent;
    assert.equal(guestDetailsSchema.safeParse(withoutConsent).success, false);
  });

  it("rejects a malformed email", () => {
    assert.equal(guestDetailsSchema.safeParse({ ...VALID_DETAILS, email: "ada@" }).success, false);
  });

  it("rejects a non-Nigerian or malformed phone", () => {
    assert.equal(guestDetailsSchema.safeParse({ ...VALID_DETAILS, phone: "12345" }).success, false);
    assert.equal(
      guestDetailsSchema.safeParse({ ...VALID_DETAILS, phone: "+15550001111" }).success,
      false,
    );
  });

  it("rejects empty names", () => {
    assert.equal(guestDetailsSchema.safeParse({ ...VALID_DETAILS, firstName: "   " }).success, false);
  });
});

describe("createOrderSchema", () => {
  const validOrder = {
    details: VALID_DETAILS,
    items: [{ ticketTypeId: TIER_A, quantity: 2 }],
  };

  it("accepts a well-formed order", () => {
    assert.equal(createOrderSchema.safeParse(validOrder).success, true);
  });

  it("requires at least one ticket", () => {
    assert.equal(createOrderSchema.safeParse({ ...validOrder, items: [] }).success, false);
  });

  it("rejects the same tier listed twice", () => {
    // order_items is unique on (order_id, ticket_type_id), so this would
    // otherwise fail deep inside the transaction with an opaque error.
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        { ticketTypeId: TIER_A, quantity: 1 },
        { ticketTypeId: TIER_A, quantity: 1 },
      ],
    });
    assert.equal(result.success, false);
  });

  it("accepts different tiers in one order", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        { ticketTypeId: TIER_A, quantity: 1 },
        { ticketTypeId: TIER_B, quantity: 3 },
      ],
    });
    assert.equal(result.success, true);
  });

  it("rejects zero, negative and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5]) {
      const result = createOrderSchema.safeParse({
        ...validOrder,
        items: [{ ticketTypeId: TIER_A, quantity }],
      });
      assert.equal(result.success, false, `quantity ${quantity} should be rejected`);
    }
  });

  it("rejects a ticket type id that is not a uuid", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ ticketTypeId: "'; drop table orders; --", quantity: 1 }],
    });
    assert.equal(result.success, false);
  });

  it("IGNORES any price the browser tries to send", () => {
    // The central rule: amounts are never accepted from the client. There is
    // no field for one, so a tampered page can put a price in the payload and
    // it simply does not survive parsing.
    const parsed = createOrderSchema.parse({
      ...validOrder,
      items: [{ ticketTypeId: TIER_A, quantity: 1, priceKobo: 1, unit_price_kobo: 1 }],
      totalKobo: 1,
    });
    assert.deepEqual(parsed.items, [{ ticketTypeId: TIER_A, quantity: 1 }]);
    assert.equal("totalKobo" in parsed, false);
  });
});

describe("fieldErrors", () => {
  it("keys messages by field path and keeps only the first per field", () => {
    const result = createOrderSchema.safeParse({
      details: { ...VALID_DETAILS, email: "nope", consent: false },
      items: [],
    });
    assert.equal(result.success, false);
    if (result.success) return;

    const errors = fieldErrors(result.error);
    assert.ok(errors["details.email"], "expected an email message");
    assert.ok(errors["details.consent"], "expected a consent message");
    assert.ok(errors["items"], "expected an items message");
  });
});
