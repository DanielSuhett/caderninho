import assert from "node:assert/strict";
import test from "node:test";

import { detectSubscriptions, type TransactionProjection } from "..";

function charges(
  dates: string[],
  fields: Partial<TransactionProjection> = {},
): TransactionProjection[] {
  return dates.map((date, index) => ({
    accountId: "account",
    amountMinor: "-1999",
    category: null,
    currency: "BRL",
    date,
    description: "Serviço sintético",
    direction: "DEBIT",
    id: `${fields.accountId ?? "account"}:${fields.currency ?? "BRL"}:${date}:${index}`,
    status: "POSTED",
    ...fields,
  }));
}
const monthly = ["2026-01-31", "2026-02-28", "2026-03-31"];

test("calendar recurrence preserves month ends and exact observed amounts beyond safe integers", () => {
  const rows = charges(monthly, { amountMinor: "-900719925474099301" });
  const result = detectSubscriptions({
    minOccurrences: 3,
    transactions: rows.reverse(),
  });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    accountId: "account",
    amountMinor: "900719925474099301",
    cadence: "monthly",
    cardNumber: null,
    currency: "BRL",
    evidence: monthly.map((date, index) => ({
      amountMinor: "900719925474099301",
      date,
      transactionId: `account:BRL:${date}:${index}`,
    })),
    firstSeen: "2026-01-31",
    lastSeen: "2026-03-31",
    maxAmountMinor: "900719925474099301",
    minAmountMinor: "900719925474099301",
    name: "Serviço sintético",
    nextExpectedDate: "2026-04-30",
    observedTotalMinor: "2702159776422297903",
    occurrences: 3,
  });
});

test("weekly, quarterly and yearly patterns have explicit calendar evidence", () => {
  const cases = [
    {
      cadence: "weekly",
      dates: ["2026-10-01", "2026-10-08", "2026-10-15"],
      next: "2026-10-22",
    },
    {
      cadence: "quarterly",
      dates: ["2026-01-15", "2026-04-15", "2026-07-15"],
      next: "2026-10-15",
    },
    {
      cadence: "yearly",
      dates: ["2024-02-29", "2025-02-28", "2026-02-28"],
      next: "2027-02-28",
    },
  ];
  for (const item of cases) {
    const result = detectSubscriptions({
      minOccurrences: 3,
      transactions: charges(item.dates),
    });
    assert.equal(result[0]?.cadence, item.cadence);
    assert.equal(result[0]?.nextExpectedDate, item.next);
  }
});

test("accounts, currencies and cards never supply each other's missing occurrences", () => {
  const rows = [
    ...charges(monthly.slice(0, 2)),
    ...charges(monthly.slice(2), { accountId: "other" }),
    ...charges(monthly.slice(2), { currency: "USD" }),
    ...charges(monthly.slice(2), {
      identification: { creditCardMetadata: { cardNumber: "1234" } },
    }),
  ];
  assert.deepEqual(
    detectSubscriptions({ minOccurrences: 3, transactions: rows }),
    [],
  );
  assert.equal(
    detectSubscriptions({ minOccurrences: 2, transactions: rows }).length,
    1,
  );
});

test("merchant identity survives varying descriptions without treating names as subscription proof", () => {
  const rows = charges(monthly).map((row, index) => ({
    ...row,
    description: `Fatura ${index}`,
    identification: {
      merchant: { cnpj: "00.000.000/0001-91", name: "Serviço" },
    },
  }));
  assert.equal(
    detectSubscriptions({ minOccurrences: 3, transactions: rows })[0]
      ?.occurrences,
    3,
  );
  assert.deepEqual(
    detectSubscriptions({
      minOccurrences: 3,
      transactions: charges(["2026-01-01"]),
    }),
    [],
  );
});

test("pending, installments, bill payments, internal transfers, unknown and zero amounts are excluded", () => {
  const cases: Partial<TransactionProjection>[] = [
    { status: "PENDING" },
    { direction: "CREDIT" },
    { amountMinor: null },
    { amountMinor: "0" },
    { identification: { creditCardMetadata: { totalInstallments: 12 } } },
    { identification: { creditCardMetadata: { installmentNumber: 2 } } },
    { identification: { operationType: "PAGAMENTO_FATURA" } },
    { identification: { operationType: "TRANSFERENCIA_MESMA_INSTITUICAO" } },
    {
      details: {
        accountId: "account",
        billId: null,
        cardNumber: null,
        id: "legacy",
        installmentNumber: 1,
        operationType: null,
        purchaseDate: null,
        totalInstallments: 12,
      },
    },
  ];
  for (const fields of cases) {
    assert.deepEqual(
      detectSubscriptions({
        minOccurrences: 3,
        transactions: charges(monthly, fields),
      }),
      [],
    );
  }
});

test("irregular dates, repeated same-day charges and materially varying amounts are not candidates", () => {
  for (const dates of [
    ["2026-01-01", "2026-01-09", "2026-03-20"],
    ["2026-01-01", "2026-01-01", "2026-02-01"],
  ]) {
    assert.deepEqual(
      detectSubscriptions({ minOccurrences: 3, transactions: charges(dates) }),
      [],
    );
  }
  const rows = charges(monthly);
  const [first] = rows;
  assert.ok(first);
  first.amountMinor = "1000";
  assert.deepEqual(
    detectSubscriptions({ minOccurrences: 3, transactions: rows }),
    [],
  );
  first.amountMinor = "1800";
  assert.equal(
    detectSubscriptions({ minOccurrences: 3, transactions: rows }).length,
    1,
  );
});
