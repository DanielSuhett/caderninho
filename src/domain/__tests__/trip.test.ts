import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTrip,
  pluggyCategory,
  type TransactionProjection,
  TripReason,
  TripVerdict,
} from "..";

let sequence = 0;
function outflow(
  fields: Partial<TransactionProjection> & { date: string },
): TransactionProjection {
  sequence += 1;
  return {
    accountId: "account",
    amountMinor: "-5000",
    category: null,
    currency: "BRL",
    description: `Loja sintética ${sequence}`,
    direction: "DEBIT",
    id: `tx-${sequence}`,
    status: "POSTED",
    ...fields,
  };
}
const period = { from: "2026-03-10", to: "2026-03-14" };
function verdicts(
  transactions: TransactionProjection[],
  history: TransactionProjection[] = [],
  recurringIds: ReadonlySet<string> = new Set(),
) {
  return classifyTrip({ ...period, history, recurringIds, transactions }).map(
    (row) => [row.description, row.verdict, row.reasons] as const,
  );
}

test("new counterparties in the period are trip expenses, reinforced by in-person codes", () => {
  const result = verdicts([
    outflow({
      date: "2026-03-11",
      description: "Restaurante Litoral",
      identification: { creditCardMetadata: { payeeMCC: "5812" } },
    }),
    outflow({
      date: "2026-03-12",
      description: "Transferência enviada pelo Pix|Passeios Baía LTDA",
    }),
  ]);
  assert.deepEqual(result, [
    [
      "Restaurante Litoral",
      TripVerdict.trip,
      [TripReason.newCounterparty, TripReason.travelMerchant],
    ],
    [
      "Transferência enviada pelo Pix|Passeios Baía LTDA",
      TripVerdict.trip,
      [TripReason.newCounterparty],
    ],
  ]);
});

test("routine signals exclude charges in their priority order", () => {
  const document = { type: "CPF", value: "000.000.000-00" };
  const result = verdicts(
    [
      outflow({
        date: "2026-03-10",
        description: "Pix",
        identification: {
          paymentData: {
            payer: { documentNumber: document },
            receiver: { documentNumber: { ...document, value: "00000000000" } },
          },
        },
      }),
      outflow({
        date: "2026-03-10",
        description: "Débito automático FATURA CARTÃO",
        identification: { operationTypeAdditionalInfo: "Débito automático" },
      }),
      outflow({
        date: "2026-03-11",
        description: "Conta de luz",
        identification: { operationType: "BOLETO" },
      }),
      outflow({
        date: "2026-03-11",
        description: "Streaming",
        id: "recurring",
      }),
      outflow({
        date: "2026-03-12",
        description: "Notebook 3/10",
        identification: { creditCardMetadata: { installmentNumber: 3 } },
      }),
      outflow({
        date: "2026-03-12",
        description: "Delivery da véspera",
        identification: {
          creditCardMetadata: { transactionDateTime: "2026-03-10T01:30:00Z" },
        },
      }),
      outflow({
        date: "2026-03-13",
        description: "App store",
        identification: { creditCardMetadata: { payeeMCC: "05818" } },
      }),
    ],
    [],
    new Set(["recurring"]),
  );
  assert.deepEqual(
    Object.fromEntries(
      result.map(([description, verdict, reasons]) => [
        description,
        [verdict, reasons],
      ]),
    ),
    {
      "App store": [TripVerdict.routine, [TripReason.digitalMerchant]],
      "Conta de luz": [TripVerdict.routine, [TripReason.billPayment]],
      "Delivery da véspera": [
        TripVerdict.routine,
        [TripReason.purchasedOutsidePeriod],
      ],
      "Débito automático FATURA CARTÃO": [
        TripVerdict.routine,
        [TripReason.automaticDebit],
      ],
      "Notebook 3/10": [TripVerdict.routine, [TripReason.earlierInstallment]],
      Pix: [TripVerdict.routine, [TripReason.ownTransfer]],
      Streaming: [TripVerdict.routine, [TripReason.recurringCharge]],
    },
  );
});

test("ambiguous outflows go to review instead of being guessed", () => {
  const result = verdicts(
    [
      outflow({ date: "2026-03-11", description: "Pix" }),
      outflow({
        date: "2026-03-11",
        description: "MP *LANCHES     Osasco BRA",
      }),
      outflow({
        date: "2026-03-12",
        description: "Compra no débito|POSTO DO BAIRRO",
      }),
    ],
    [outflow({ date: "2026-02-01", description: "Posto do Bairro" })],
  );
  assert.deepEqual(
    result.map(([, verdict, reasons]) => [verdict, reasons]),
    [
      [TripVerdict.review, [TripReason.unidentifiedCounterparty]],
      [TripVerdict.review, [TripReason.paymentGateway]],
      [TripVerdict.review, [TripReason.knownCounterparty]],
    ],
  );
});

test("card purchases made in the period are kept even when posted later; others are dropped", () => {
  const result = verdicts([
    outflow({
      date: "2026-03-16",
      description: "Pousada Sintética",
      identification: {
        creditCardMetadata: { transactionDateTime: "2026-03-13T15:00:00Z" },
      },
    }),
    outflow({ date: "2026-03-17", description: "Depois da viagem" }),
    outflow({
      date: "2026-03-12",
      description: "Estorno",
      direction: "CREDIT",
    }),
  ]);
  assert.deepEqual(result, [
    ["Pousada Sintética", TripVerdict.trip, [TripReason.newCounterparty]],
  ]);
});

test("door-to-door sellers are not treated as digital merchants", () => {
  const result = verdicts([
    outflow({
      date: "2026-03-12",
      description: "Vendedor de praia",
      identification: { creditCardMetadata: { payeeMCC: "5963" } },
    }),
  ]);
  assert.deepEqual(result, [
    ["Vendedor de praia", TripVerdict.trip, [TripReason.newCounterparty]],
  ]);
});

test("provider travel labels map to the Viagens category", () => {
  for (const label of [
    "Travel",
    "Accommodation",
    "Airport and airlines",
    "Bus tickets",
    "Mileage programs",
  ]) {
    assert.equal(pluggyCategory(label), "viagens", label);
  }
  assert.equal(pluggyCategory("Landmarks and museums"), "lazer");
});
