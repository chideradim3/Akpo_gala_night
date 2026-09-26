import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatNigerianPhone, normalizeNigerianPhone } from "./phone.js";

const EXPECTED = "+2348012345678";

describe("normalizeNigerianPhone", () => {
  it("accepts the way most people write it", () => {
    assert.equal(normalizeNigerianPhone("08012345678"), EXPECTED);
  });

  it("accepts international forms", () => {
    assert.equal(normalizeNigerianPhone("+2348012345678"), EXPECTED);
    assert.equal(normalizeNigerianPhone("2348012345678"), EXPECTED);
  });

  it("accepts the national number alone", () => {
    assert.equal(normalizeNigerianPhone("8012345678"), EXPECTED);
  });

  it("ignores spaces, dashes and brackets", () => {
    assert.equal(normalizeNigerianPhone("0801 234 5678"), EXPECTED);
    assert.equal(normalizeNigerianPhone("0801-234-5678"), EXPECTED);
    assert.equal(normalizeNigerianPhone(" +234 (801) 234 5678 "), EXPECTED);
  });

  it("accepts every mobile prefix range", () => {
    assert.equal(normalizeNigerianPhone("07012345678"), "+2347012345678");
    assert.equal(normalizeNigerianPhone("09012345678"), "+2349012345678");
  });

  it("rejects numbers that are too short or too long", () => {
    assert.equal(normalizeNigerianPhone("0801234567"), null);
    assert.equal(normalizeNigerianPhone("080123456789"), null);
  });

  it("rejects landlines — the organiser needs a mobile", () => {
    assert.equal(normalizeNigerianPhone("012345678"), null);
  });

  it("rejects junk rather than silently stripping it", () => {
    assert.equal(normalizeNigerianPhone(""), null);
    assert.equal(normalizeNigerianPhone("   "), null);
    assert.equal(normalizeNigerianPhone("+234-not-a-number"), null);
    assert.equal(normalizeNigerianPhone("hello"), null);
  });

  it("is idempotent — normalising an already-stored number is a no-op", () => {
    assert.equal(normalizeNigerianPhone(EXPECTED), EXPECTED);
  });
});

describe("formatNigerianPhone", () => {
  it("shows the national form people recognise", () => {
    assert.equal(formatNigerianPhone(EXPECTED), "0801 234 5678");
  });

  it("returns anything unexpected unchanged rather than mangling it", () => {
    assert.equal(formatNigerianPhone("+1555000000"), "+1555000000");
  });
});
