import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatNaira,
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
