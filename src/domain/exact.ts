import Big from "big.js";
import { parse } from "lossless-json";
import { z } from "zod/v4";

import { JsonValueSchema } from "../shared";
import { FaultCode } from "./enums";
import { fail } from "./fault.entity";
import type { MoneyInput } from "./finance.entity";
import { parseDomain } from "./validation";

const canonicalMinorPattern = /^-?(0|[1-9]\d{0,29})$/;
const decimalPattern = /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const identifierPattern = /^[a-zA-Z0-9_-]{1,128}$/;

export function assertMinor(value: string) {
  if (!canonicalMinorPattern.test(value)) {
    throw new Error(
      "Minor amount must be canonical integer, at most 30 digits",
    );
  }
}

// Preserve JSON numeric lexemes before JavaScript can round amounts, quantities or rates.
export function exactJSON(text: string) {
  return JsonValueSchema.parse(parse(text, null, (lexeme) => lexeme));
}

export function decimal(value: MoneyInput) {
  if (value === null || value === undefined) {
    return null;
  }
  const s = String(value);

  if (s.length > 100 || !decimalPattern.test(s)) {
    fail(FaultCode.INVALID_DECIMAL);
  }
  const exponent = Number(s.toLowerCase().split("e")[1] ?? "0");

  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 30) {
    fail(FaultCode.DECIMAL_RANGE);
  }

  return new Big(s.startsWith("+") ? s.slice(1) : s).toFixed();
}

export function minor(value: MoneyInput, currency: string) {
  if (value === null || value === undefined) {
    return null;
  }

  // Explicit currency scales; an unknown currency is queryable, never silently assumed 2dp.
  const scales: Record<string, number> = {
    ARS: 2,
    AUD: 2,
    BHD: 3,
    BRL: 2,
    CAD: 2,
    CHF: 2,
    CLP: 0,
    EUR: 2,
    GBP: 2,
    JPY: 0,
    KWD: 3,
    USD: 2,
  };

  const scale = scales[currency];

  if (typeof scale !== "number") {
    fail(FaultCode.CURRENCY_SCALE_UNSUPPORTED);
  }
  const d = decimal(value);

  if (d === null) {
    fail(FaultCode.INVALID_DECIMAL);
  }
  const [whole, frac = ""] = d.replace("-", "").split(".");

  if (frac.length > scale) {
    fail(FaultCode.MONEY_PRECISION_UNSUPPORTED);
  }

  return (
    BigInt(whole + frac.padEnd(scale, "0")) * (d.startsWith("-") ? -1n : 1n)
  ).toString();
}

export function day(value: unknown) {
  if (
    typeof value !== "string" ||
    !dayPattern.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    fail(FaultCode.INVALID_DATE);
  }

  return value;
}

export const accountingDay = (value: string | null | undefined) =>
  value === null || value === undefined ? null : day(value.slice(0, 10));

export function isMatureDate({
  date,
  referenceDay,
}: {
  date: string | null | undefined;
  referenceDay: string | null;
}) {
  return (
    date !== null &&
    date !== undefined &&
    referenceDay !== null &&
    date <= referenceDay
  );
}

export function localDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(value);
}

export function id(value: unknown) {
  return parseDomain(
    z.string().regex(identifierPattern),
    value,
    FaultCode.INVALID_ID,
  );
}

export function compareDecimal(a: MoneyInput, b: MoneyInput) {
  const x = decimal(a);

  if (x === null) {
    fail(FaultCode.INVALID_DECIMAL);
  }
  const y = decimal(b);

  if (y === null) {
    fail(FaultCode.INVALID_DECIMAL);
  }

  return new Big(x).cmp(y);
}
