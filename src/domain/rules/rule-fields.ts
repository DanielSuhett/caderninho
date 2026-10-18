import type { Derived, TransactionContext } from "#domain/rules/rules.types.ts";

const transactionFields = {
  id: true,
  account_id: true,
  account_name: true,
  description: true,
  counterparty_name: true,
  direction: true,
  operation: true,
  payment_method: true,
  currency: true,
  account_type: true,
  original_category: true,
  amount: true,
  amount_abs: true,
  date: true,
  installment_number: true,
  total_installments: true,
} satisfies Record<keyof TransactionContext, true>;

const resultFields = {
  category_id: true,
  category: true,
  category_group_id: true,
  category_group: true,
  description: true,
  tags: true,
  ignored: true,
} satisfies Record<Exclude<keyof Derived, "evidence">, true>;

export const fields = new Set([
  ...Object.keys(transactionFields).map((field) => `tx.${field}`),
  ...Object.keys(resultFields).map((field) => `result.${field}`),
]);

export const allowed = (path: string) =>
  fields.has(path) || /^result\.tags\.[a-zA-Z0-9_-]{1,80}$/.test(path);
export const accents = (text: string) =>
  text.normalize("NFD").replace(/\p{Mn}/gu, "");
