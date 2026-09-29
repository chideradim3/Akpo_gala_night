import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatNaira,
  formatNairaShort,
  kobo,
  koboToNaira,
  multiplyKobo,
  nairaToKobo,
  sumKobo,
} from "./money.js";

/**
 * Run with:  npm test
 *
 * These are the only unit tests in Phase 1, and deliberately so: the kobo
 * rule is the one piece of logic that exists yet, and it is the piece a bug
 * in would quietly corrupt every order total.
 */

describe("nairaToKobo", () => {
  it("converts whole Naira", () => {
    assert.equal(nairaToKobo(5_000), 500_000);
    assert.equal(nairaToKobo(200_000), 20_000_000);
    assert.equal(nairaToKobo(0), 0);
  });

  it("accepts two decimal places", () => {
    assert.equal(nairaToKobo(10.5), 1_050);
    assert.equal(nairaToKobo(0.01), 1);
  });

  it("rejects precision finer than one kobo rather than rounding it away", () => {
    assert.throws(() => nairaToKobo(50.555), /precision/);
  });

  it("rejects nonsense", () => {
    assert.throws(() => nairaToKobo(Number.NaN));
    assert.throws(() => nairaToKobo(-1));
  });
});

describe("kobo", () => {
  it("rejects fractional kobo", () => {
    assert.throws(() => kobo(100.5), /whole number/);
  });

  it("rejects negative amounts", () => {
    assert.throws(() => kobo(-1), /negative/);
  });
});

describe("formatNaira", () => {
  it("formats whole Naira without decimals", () => {
    assert.equal(formatNaira(kobo(500_000)), "₦5,000");
    assert.equal(formatNaira(kobo(20_000_000)), "₦200,000");
    assert.equal(formatNaira(kobo(0)), "₦0");
  });

  it("shows the kobo part when there is one", () => {
    assert.equal(formatNaira(kobo(1_050)), "₦10.50");
  });
});

describe("formatNairaShort", () => {
  // The four examples the short form was asked for, written as Naira so
  // the intent is readable, converted so the kobo rule still holds.
  it("shortens the asked-for amounts", () => {
    assert.equal(formatNairaShort(nairaToKobo(1_000_000)), "₦1M");
    assert.equal(formatNairaShort(nairaToKobo(500_000)), "₦500K");
    assert.equal(formatNairaShort(nairaToKobo(20_000)), "₦20K");
    assert.equal(formatNairaShort(nairaToKobo(3_000)), "₦3K");
  });

  it("keeps one decimal where it says something", () => {
    assert.equal(formatNairaShort(nairaToKobo(1_500_000)), "₦1.5M");
    assert.equal(formatNairaShort(nairaToKobo(2_500)), "₦2.5K");
  });

  it("never shows a trailing .0", () => {
    assert.equal(formatNairaShort(nairaToKobo(1_000_000)), "₦1M");
    assert.equal(formatNairaShort(nairaToKobo(2_000_000)), "₦2M");
    assert.equal(formatNairaShort(nairaToKobo(10_000)), "₦10K");
  });

  it("switches to M at exactly a million, and K at exactly a thousand", () => {
    assert.equal(formatNairaShort(nairaToKobo(999_999)), "₦999.9K");
    assert.equal(formatNairaShort(nairaToKobo(1_000_000)), "₦1M");
    assert.equal(formatNairaShort(nairaToKobo(999)), "₦999");
    assert.equal(formatNairaShort(nairaToKobo(1_000)), "₦1K");
  });

  it("shows amounts below a thousand in full", () => {
    assert.equal(formatNairaShort(nairaToKobo(500)), "₦500");
    assert.equal(formatNairaShort(kobo(0)), "₦0");
  });

  it("never rounds a price upwards", () => {
    // ₦1,990,000 advertised as "₦2M" would be a higher price than the one
    // actually charged. Truncating keeps the short form honest.
    assert.equal(formatNairaShort(nairaToKobo(1_990_000)), "₦1.9M");
    assert.equal(formatNairaShort(nairaToKobo(19_900)), "₦19.9K");
  });

  it("leaves formatNaira alone, which is what every other page uses", () => {
    assert.equal(formatNaira(nairaToKobo(1_000_000)), "₦1,000,000");
    assert.equal(formatNaira(nairaToKobo(20_000)), "₦20,000");
  });
});

describe("arithmetic", () => {
  it("sums without floating point drift", () => {
    assert.equal(sumKobo(kobo(500_000), kobo(500_000), kobo(20_000_000)), 21_000_000);
  });

  it("multiplies a unit price by a quantity", () => {
    assert.equal(multiplyKobo(kobo(500_000), 3), 1_500_000);
    assert.equal(multiplyKobo(kobo(500_000), 0), 0);
  });

  it("rejects a fractional quantity", () => {
    assert.throws(() => multiplyKobo(kobo(500_000), 1.5), /whole number/);
  });

  it("round-trips through Naira", () => {
    assert.equal(koboToNaira(nairaToKobo(200_000)), 200_000);
  });
});
