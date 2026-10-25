import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import { normalizeAccount, normalizeTransaction } from "../../src/domain";
import {
  transactionIdentification,
  transactionIdentificationInput,
} from "../../src/fixtures/transaction-identification";
import { createPluggyAdapter } from "../../src/worker/pluggy";
import { sourceUrl } from "../support";
import { mockNetwork, syntheticJwt } from "../support/network";
import { account, setup, transaction } from "./fixture";

beforeEach(setup);
afterEach(() => vi.unstubAllGlobals());
function adapter() {
  return createPluggyAdapter({
    clientId: "synthetic",
    clientSecret: "synthetic-private",
  });
}
test("official SDK preserves numeric lexemes and only reads concrete account/transaction endpoints", async () => {
  const paths: string[] = [];
  mockNetwork((input) => {
    const url = sourceUrl(input);
    paths.push(url.pathname);
    if (url.pathname === "/auth") {
      return Promise.resolve(Response.json({ apiKey: syntheticJwt() }));
    }
    if (url.pathname === "/items/c") {
      return Promise.resolve(
        Response.json({
          connector: { id: 200, name: "Synthetic bank" },
          id: "c",
          status: "UPDATED",
        }),
      );
    }
    if (url.pathname === "/accounts") {
      return Promise.resolve(
        Response.json({
          page: 1,
          results: [
            {
              ...account(),
              privateMetadata: { ownerDocument: "synthetic-private" },
              taxNumber: "11122233344",
              updatedAt: "2026-10-02T00:00:00Z",
            },
          ],
          total: 1,
          totalPages: 1,
        }),
      );
    }
    if (url.pathname === "/v2/transactions") {
      return Promise.resolve(
        new Response(
          '{"results":[{"id":"t","accountId":"a","amount":90071992547409931234567890.12,"currencyCode":"BRL","date":"2026-10-01T00:00:00.000Z","description":"Synthetic","type":"DEBIT","updatedAt":"2026-10-02T00:00:00Z","paymentData":{"payer":{"documentNumber":{"value":"11122233344"}}},"merchant":{"name":"Synthetic shop"},"privateMetadata":"synthetic-private"}],"next":null}',
        ),
      );
    }
    throw new Error("Unexpected endpoint");
  });
  const source = adapter();
  assert.deepEqual(await source.connection("c"), {
    connector: { id: "200", name: "Synthetic bank" },
    id: "c",
  });
  const [a] = await source.accounts("c");
  assert.ok(a);
  const page = await source.transactions("a", null);
  const [tx] = page.records;
  assert.ok(tx);
  assert.equal(
    normalizeTransaction(tx, normalizeAccount(a, "c").id).amountMinor,
    "9007199254740993123456789012",
  );
  assert.deepEqual(a, account());
  assert.deepEqual(tx, {
    accountId: "a",
    amount: "90071992547409931234567890.12",
    currencyCode: "BRL",
    date: "2026-10-01T00:00:00.000Z",
    description: "Synthetic",
    id: "t",
    merchant: { name: "Synthetic shop" },
    paymentData: { payer: { documentNumber: { value: "11122233344" } } },
    status: "POSTED",
    type: "DEBIT",
    updatedAt: "2026-10-02T00:00:00Z",
  });
  assert.equal(paths.filter((path) => path === "/auth").length, 1);
  assert.equal(paths.length, 4);
});
test("official SDK retains the complete allowlisted identification without opaque provider payloads", async () => {
  mockNetwork((input) =>
    Promise.resolve(
      sourceUrl(input).pathname === "/auth"
        ? Response.json({ apiKey: syntheticJwt() })
        : Response.json({
            next: null,
            results: [
              {
                ...transaction(),
                ...transactionIdentificationInput,
                privateMetadata: "discard",
              },
            ],
          }),
    ),
  );
  const [row] = (await adapter().transactions("a", null)).records;
  assert.ok(row);
  assert.deepEqual(
    normalizeTransaction(row, "a").identification,
    transactionIdentification,
  );
  assert.equal(Object.hasOwn(row, "privateMetadata"), false);
});

test("missing/mismatched cursor scope and incomplete account listings cannot become complete collections", async () => {
  let response: object = { results: [transaction()] };
  mockNetwork((input) =>
    sourceUrl(input).pathname === "/auth"
      ? Promise.resolve(Response.json({ apiKey: syntheticJwt() }))
      : Promise.resolve(Response.json(response)),
  );
  const source = adapter();
  await assert.rejects(source.transactions("a", null));
  response = {
    next: "https://untrusted.example/?accountId=a&after=x",
    results: [transaction()],
  };
  await assert.rejects(source.transactions("a", null), {
    message: "INVALID_PAGINATION",
  });
  response = { next: "?accountId=other&after=x", results: [transaction()] };
  await assert.rejects(source.transactions("a", null), {
    message: "CURSOR_SCOPE_MISMATCH",
  });
  response = { next: "?accountId=a&after=old", results: [transaction()] };
  await assert.rejects(source.transactions("a", "old"), {
    message: "REPEATED_CURSOR",
  });
  response = { next: "?accountId=a&after=new", results: [] };
  await assert.rejects(source.transactions("a", null), {
    message: "REPEATED_CURSOR",
  });
  response = { page: 1, results: [account()], total: 2, totalPages: 2 };
  await assert.rejects(source.accounts("c"), { message: "INCOMPLETE_PAGE" });
  response = { next: null, results: [] };
  assert.deepEqual(await source.transactions("a", null), {
    next: null,
    records: [],
  });
});
test("transport retries stay disabled and rate-limit metadata is safe for the Workflow budget", async () => {
  let calls = 0;
  mockNetwork((input) => {
    if (sourceUrl(input).pathname === "/auth") {
      return Promise.resolve(Response.json({ apiKey: syntheticJwt() }));
    }
    calls += 1;
    return Promise.resolve(
      new Response("synthetic-private-body", {
        headers: { "Retry-After": "42" },
        status: 429,
      }),
    );
  });
  await assert.rejects(
    adapter().transactions("a", null),
    (error) =>
      error instanceof Error &&
      error.message === "UPSTREAM_RATE_LIMIT" &&
      JSON.stringify(error).includes("42") &&
      !JSON.stringify(error).includes("synthetic-private"),
  );
  assert.equal(calls, 1);
});

test("supplemental SDK pages preserve exact money, product identity, currencies and pagination", async () => {
  let kind = "investments";
  const state = { itemId: "c" };
  mockNetwork((input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return Promise.resolve(Response.json({ apiKey: syntheticJwt() }));
    }
    assert.equal(url.pathname, `/${kind}`);
    if (kind === "investments") {
      return Promise.resolve(
        new Response(
          `{"page":1,"total":2,"totalPages":2,"results":[{"id":"i","itemId":"${state.itemId}","name":"Fund","type":"MUTUAL_FUND","currencyCode":"BRL","amount":9007199254740993.01,"date":"2026-10-20"}]}`,
        ),
      );
    }
    if (kind === "loans") {
      return Promise.resolve(
        Response.json({
          page: 1,
          results: [
            {
              contractAmount: "123.45",
              currencyCode: "USD",
              id: "l",
              installments: {
                paidInstallments: 1,
                totalNumberOfInstallments: 4,
              },
              itemId: "c",
              productName: "Loan",
            },
          ],
          total: 1,
          totalPages: 1,
        }),
      );
    }
    return Promise.resolve(
      Response.json({
        page: 1,
        results: [
          {
            dueDate: "2026-10-28",
            financeCharges: [
              { amount: "0.01", currencyCode: "BRL", type: "IOF" },
            ],
            id: "b",
            payments: [
              {
                amount: "10.01",
                currencyCode: "BRL",
                paymentDate: "2026-10-21",
              },
            ],
            totalAmount: "100.01",
            totalAmountCurrencyCode: "BRL",
          },
        ],
        total: 1,
        totalPages: 1,
      }),
    );
  });
  const client = adapter();
  const request = { id: "c", observedAt: "2026-10-22T00:00:00Z", page: 1 };
  const investments = await client.products({
    ...request,
    kind: "investments",
  });
  assert.equal(investments.next, 2);
  assert.equal(investments.records[0]?.amountMinor, "900719925474099301");
  state.itemId = "other";
  await assert.rejects(
    () => client.products({ ...request, kind: "investments" }),
    { message: "SOURCE_IDENTITY_MISMATCH" },
  );
  state.itemId = "c";
  kind = "loans";
  const loans = await client.products({ ...request, kind: "loans" });
  assert.equal(loans.records[0]?.currency, "USD");
  kind = "bills";
  const bills = await client.products({ ...request, kind: "bills" });
  assert.equal(bills.records[0]?.amountMinor, "10001");
});
