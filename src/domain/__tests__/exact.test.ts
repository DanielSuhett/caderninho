import assert from "node:assert/strict";
import test from "node:test";

import { assertMinor, decimal, exactJSON, minor } from "..";

const canonicalMinorErrorPattern = /canonical integer, at most 30 digits/;
const invalidDecimalPattern = /INVALID_DECIMAL/;
const decimalRangePattern = /DECIMAL_RANGE/;
const currencyScaleUnsupportedPattern = /CURRENCY_SCALE_UNSUPPORTED/;
const moneyPrecisionUnsupportedPattern = /MONEY_PRECISION_UNSUPPORTED/;

await test("provider JSON retains numeric lexemes and rejects malformed syntax before shape validation", () => {
  assert.deepEqual(
    exactJSON(
      '{"amount":9007199254740993.29,"values":[1e3,null,true],"name":"Synthetic"}',
    ),
    {
      amount: "9007199254740993.29",
      name: "Synthetic",
      values: ["1e3", null, true],
    },
  );
  assert.throws(() => exactJSON('{"amount":'), SyntaxError);
});

await test("stored minor units preserve the shared integer and 30-digit precision boundary", () => {
  for (const value of [
    "0",
    "-0",
    "1",
    "-1",
    "9".repeat(30),
    `-${"9".repeat(30)}`,
  ]) {
    assert.doesNotThrow(() => assertMinor(value));
  }

  for (const value of [
    "",
    "00",
    "01",
    "+1",
    "1.0",
    "1e2",
    "9".repeat(31),
    `-${"9".repeat(31)}`,
  ]) {
    assert.throws(() => assertMinor(value), canonicalMinorErrorPattern);
  }
});

await test("decimal canonical output preserves signs, exponent bounds and values beyond IEEE precision", () => {
  for (const [input, expected] of [
    [null, null],
    [undefined, null],
    [-0, "0"],
    ["-000.000e30", "0"],
    ["+001.2300", "1.23"],
    ["-000001.2300e-2", "-0.0123"],
    ["1e-30", `0.${"0".repeat(29)}1`],
    ["1e30", `1${"0".repeat(30)}`],
    ["9007199254740993.290000", "9007199254740993.29"],
    [
      "123456789012345678901234567890.1234567890123456789",
      "123456789012345678901234567890.1234567890123456789",
    ],
    [0.29, "0.29"],
  ] satisfies [string | number | null | undefined, string | null][]) {
    assert.equal(decimal(input), expected);
  }
});

await test("decimal rejects malformed values and unbounded exponents", () => {
  for (const input of [
    "",
    "NaN",
    "Infinity",
    ".1",
    "1.",
    " 1",
    "1e",
    "1e+",
    "1".repeat(101),
  ] as const) {
    assert.throws(() => decimal(input), invalidDecimalPattern);
  }

  for (const input of ["1e31", "1e-31", "1e99999999999999999"]) {
    assert.throws(() => decimal(input), decimalRangePattern);
  }
});

await test("currency scales retain exact integers and reject excess precision without rounding", () => {
  assert.equal(minor("9007199254740993.29", "BRL"), "900719925474099329");
  assert.equal(minor("-9007199254740993.29", "USD"), "-900719925474099329");
  assert.equal(minor("123.000", "JPY"), "123");
  assert.equal(minor("1.2340", "KWD"), "1234");
  assert.equal(minor("0.001", "BHD"), "1");
  assert.equal(minor(null, "XYZ"), null);
  assert.throws(() => minor("invalid", "XYZ"), currencyScaleUnsupportedPattern);

  for (const [value, currency] of [
    ["1.001", "BRL"],
    ["1.1", "JPY"],
    ["1.2345", "KWD"],
  ] as const) {
    assert.throws(
      () => minor(value, currency),
      moneyPrecisionUnsupportedPattern,
    );
  }
});
