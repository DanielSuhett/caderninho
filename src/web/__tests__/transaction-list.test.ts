import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { z } from "zod/v4";

import { PortalTransactionListSchema } from "../../contracts";
import { transactionFixture } from "../../fixtures/finance";
import { transactionIdentification } from "../../fixtures/transaction-identification";
import {
  TransactionDetailContent,
  TransactionList,
} from "../account/transaction-list";

type Transaction = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
const row: Transaction = transactionFixture({
  accountId: "card",
  amountMinor: "12345",
  category: "groceries",
  description: "Compra no mercado",
  personId: "self",
  personName: "Pessoa exemplo",
});

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
test("transactions keep exact money, direction, category and owner without technical identifiers in the interface", () => {
  const html = render(row);
  const summary = html;
  assert.ok(summary.includes("123,45 BRL"));
  assert.ok(summary.includes("Saída"));
  assert.equal(summary.includes("−"), false);
  assert.ok(summary.includes("Alimentação"));
  assert.equal(summary.includes("synthetic-transaction"), false);
  assert.equal(summary.includes("Pessoa exemplo"), false);
  assert.ok(html.includes("Alimentação"));
  const details = renderToStaticMarkup(
    createElement(TransactionDetailContent, {
      account: "Cartão exemplo",
      category: "Alimentação",
      row,
    }),
  );
  assert.ok(details.includes("Pessoa exemplo"));
  assert.equal(details.includes("synthetic-transaction"), false);
  assert.ok(details.includes("123,45 BRL"));
  assert.ok(details.includes("Alimentação"));
  assert.ok(render(row, true).includes("Pessoa exemplo"));
});

test("details expose identifying source fields and keep them out of list summaries", () => {
  const identified = { ...row, identification: transactionIdentification };
  const html = renderToStaticMarkup(
    createElement(TransactionDetailContent, {
      account: "Cartão exemplo",
      category: "Alimentação",
      row: identified,
    }),
  );
  for (const value of [
    "Mercado de exemplo",
    "00.000.000/0001-91",
    "4711302",
    "Pagador sintético",
    "Recebedor sintético",
    "synthetic-end-to-end",
    "5411",
    "institution-synthetic",
    "Ordem no dia",
    "synthetic-authentication",
    "9.007.199.254.740.993,01",
  ]) {
    assert.ok(html.includes(value), value);
  }
  assert.equal(render(identified).includes("00.000.000/0001-91"), false);
  const escaped = renderToStaticMarkup(
    createElement(TransactionDetailContent, {
      account: "Cartão exemplo",
      category: "Alimentação",
      row: {
        ...row,
        identification: { merchant: { name: "<script>private</script>" } },
      },
    }),
  );
  assert.equal(escaped.includes("<script>private</script>"), false);
  assert.ok(escaped.includes("&lt;script&gt;private&lt;/script&gt;"));
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
  const summary = html;
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
    ).includes("Valor indisponível · BRL"),
  );
});

test("positive credits receive an explicit plus while conflicting source signs keep their own direction", () => {
  const credit = render({ ...row, amountMinor: "12345", direction: "CREDIT" });
  assert.ok(credit.includes("+123,45 BRL"));
  assert.ok(credit.includes("Entrada"));
  const conflictingCredit = render({
    ...row,
    amountMinor: "-12345",
    direction: "CREDIT",
  });
  assert.ok(conflictingCredit.includes("−123,45 BRL"));
  assert.ok(conflictingCredit.includes("Entrada"));
  assert.equal(conflictingCredit.includes("+−"), false);
  const zero = render({ ...row, amountMinor: "0", direction: "CREDIT" });
  assert.ok(zero.includes("0,00 BRL"));
  assert.ok(zero.includes("Entrada"));
  assert.equal(zero.includes("+0,00"), false);
});

test("a grouped purchase identifies the displayed installment and retains source dates and pending installments in its disclosure", () => {
  const purchase: Transaction = {
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
  };
  const html = render(purchase);
  const details = renderToStaticMarkup(
    createElement(TransactionDetailContent, {
      account: "Cartão exemplo",
      category: "Alimentação",
      referenceDay: "2026-10-23",
      row: purchase,
    }),
  );
  const summary = html;
  for (const text of [
    "Parcela 2/4",
    "123,45 BRL",
    "Primeira conhecida",
    "1 pendente",
    "1 futura",
  ]) {
    assert.ok(summary.includes(text));
  }
  assert.ok(details.includes("Primeira parcela conhecida em"));
  assert.ok(details.includes("Pagamento não informado"));
  assert.ok(details.includes("2 parcelas ainda não recebidas"));
  assert.equal(details.includes(">Paga<"), false);
  assert.ok(details.includes("01/11/2099"));
});
