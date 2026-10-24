import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { z } from "zod/v4";

import { PortalTransactionListSchema } from "../../contracts";
import { TransactionList } from "../account/transaction-list";

const summaryPattern = /<summary[^>]*>(.*?)<\/summary>/s;
type Transaction = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
const row: Transaction = {
  accountId: "card",
  amountMinor: "12345",
  anchorDate: "2026-10-10",
  anchorKind: "transaction",
  cardNumber: null,
  category: "groceries",
  currency: "BRL",
  date: "2026-10-10",
  description: "Compra no mercado",
  direction: "DEBIT",
  id: "synthetic-transaction",
  ignored: false,
  installmentNumber: null,
  installments: [],
  manual: false,
  personId: "self",
  personName: "Pessoa exemplo",
  purchaseDate: null,
  status: "POSTED",
  totalInstallments: null,
};
function render(record: typeof row, showOwner = false) {
  const { data } = PortalTransactionListSchema.parse({
    data: { cursor: null, records: [record], referenceDay: "2026-10-23" },
    partial: false,
  });
  return renderToStaticMarkup(
    createElement(TransactionList, {
      accounts: [{ id: "card", name: "Cartão exemplo" }],
      categories: [{ id: "groceries", name: "Alimentação" }],
      records: data.records,
      referenceDay: data.referenceDay,
      showOwner,
    }),
  );
}
test("collapsed transactions keep exact source money and direction while supplementary data remains in the disclosure", () => {
  const html = render(row);
  const summary = html.match(summaryPattern)?.[1] ?? "";
  assert.ok(summary.includes("123,45 BRL"));
  assert.ok(summary.includes("Saída"));
  assert.equal(summary.includes("−"), false);
  assert.equal(summary.includes("Alimentação"), false);
  assert.equal(summary.includes("synthetic-transaction"), false);
  assert.equal(summary.includes("Pessoa exemplo"), false);
  assert.ok(html.includes("Alimentação"));
  assert.ok(html.includes("Pessoa exemplo"));
  assert.ok(html.includes("synthetic-transaction"));
  assert.ok(
    render(row, true).match(summaryPattern)?.[1]?.includes("Pessoa exemplo"),
  );
});
test("pending, future and ignored records stay explicit; zero and unavailable money are distinct", () => {
  const html = render({
    ...row,
    amountMinor: "0",
    anchorDate: "2026-11-01",
    date: "2026-11-01",
    ignored: true,
    status: "PENDING",
  });
  const summary = html.match(summaryPattern)?.[1] ?? "";
  for (const text of ["0,00 BRL", "Pendente", "Futura", "Ignorada"]) {
    assert.ok(summary.includes(text));
  }
  const { data } = PortalTransactionListSchema.parse({
    data: {
      cursor: null,
      records: [{ ...row, amountMinor: null }],
      referenceDay: "2026-10-23",
    },
    partial: false,
  });
  assert.ok(
    renderToStaticMarkup(
      createElement(TransactionList, {
        accounts: [],
        categories: [],
        records: data.records,
      }),
    ).includes("Valor indisponível"),
  );
});

test("a grouped purchase identifies the displayed installment and retains source dates and pending installments in its disclosure", () => {
  const html = render({
    ...row,
    anchorKind: "first_seen",
    installmentNumber: 2,
    installments: [
      { ...row, installmentNumber: 2, totalInstallments: 4 },
      {
        ...row,
        date: "2099-11-01",
        id: "future-installment",
        installmentNumber: 3,
        status: "PENDING",
        totalInstallments: 4,
      },
    ],
    totalInstallments: 4,
  });
  const summary = html.match(summaryPattern)?.[1] ?? "";
  for (const text of [
    "Parcela 2/4",
    "123,45 BRL",
    "Primeira conhecida:",
    "1 pendente",
    "1 futura",
  ]) {
    assert.ok(summary.includes(text));
  }
  assert.ok(html.includes("Primeira parcela conhecida em"));
  assert.ok(
    html.includes("O estado da origem não indica pagamento da fatura."),
  );
  assert.ok(html.includes("01/11/2099"));
});
