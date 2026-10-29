import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { type ChangeEvent, type MouseEvent, useCallback } from "react";

import type { PortalResponse } from "../../contracts";
import {
  RuleOperator,
  TransactionDirection,
  TransactionStatus,
} from "../../domain";
import { randomId } from "../random-id";
import { UiButton } from "../ui";
import {
  conditionDraft,
  type DraftAlternative,
  type DraftCondition,
} from "./rule-draft";
import { conditionFields } from "./rule-presentation";

type Accounts = { id: string; name: string; personName: string }[];
type Change = (
  alternative: string,
  condition: string,
  part: string,
  value: string,
) => void;

const currencies = [
  "BRL",
  "USD",
  "EUR",
  "GBP",
  "ARS",
  "AUD",
  "BHD",
  "CAD",
  "CHF",
  "CLP",
  "JPY",
  "KWD",
];
type Options = { label: string; value: string }[];
const textOperators: Options = [
  { label: "contém", value: RuleOperator.contains },
  { label: "não contém", value: RuleOperator.not_contains },
  { label: "é igual a", value: RuleOperator.equals },
  { label: "começa com", value: RuleOperator.starts_with },
];
const orderedOperators: Options = [
  { label: "é igual a", value: RuleOperator.equals },
  { label: "maior ou igual", value: RuleOperator.gte },
  { label: "menor ou igual", value: RuleOperator.lte },
];
const equalsOnly: Options = [
  { label: "é igual a", value: RuleOperator.equals },
];
const operatorsByField: Record<string, Options> = {
  amount: orderedOperators,
  date: orderedOperators,
  description: textOperators,
  receiverName: textOperators,
};
const valuePlaceholders: Record<string, string> = {
  amount: "Ex.: 150,00",
  receiverDocument: "00.000.000/0000-00",
};

export function RuleConditionsBuilder({
  accounts,
  alternatives,
  change,
  currency,
  setCurrency,
  snapshot,
}: {
  accounts: Accounts;
  alternatives: DraftAlternative[];
  change: (next: (previous: DraftAlternative[]) => DraftAlternative[]) => void;
  currency: string;
  setCurrency: (value: string) => void;
  snapshot: PortalResponse;
}) {
  const onCondition = useCallback<Change>(
    (alternative, condition, part, value) =>
      change((previous) =>
        previous.map((a) =>
          a.id === alternative
            ? {
                ...a,
                conditions: a.conditions.map((c) => {
                  if (c.id !== condition) {
                    return c;
                  }
                  if (part === "field") {
                    return { ...conditionDraft(value), id: c.id };
                  }
                  return { ...c, [part]: value };
                }),
              }
            : a,
        ),
      ),
    [change],
  );
  const addAlternative = useCallback(
    () =>
      change((previous) => [
        ...previous,
        { conditions: [conditionDraft()], id: randomId() },
      ]),
    [change],
  );
  const removeAlternative = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.alternative;
      change((previous) => previous.filter((a) => a.id !== id));
    },
    [change],
  );
  const addCondition = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.alternative;
      change((previous) =>
        previous.map((a) =>
          a.id === id
            ? { ...a, conditions: [...a.conditions, conditionDraft()] }
            : a,
        ),
      );
    },
    [change],
  );
  const removeCondition = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { alternative, condition } = event.currentTarget.dataset;
      change((previous) =>
        previous.map((a) =>
          a.id === alternative
            ? {
                ...a,
                conditions: a.conditions.filter((c) => c.id !== condition),
              }
            : a,
        ),
      );
    },
    [change],
  );
  const onCurrency = useCallback(
    (value: string | null) => setCurrency(value ?? ""),
    [setCurrency],
  );
  const comparesAmount = alternatives.some((a) =>
    a.conditions.some((c) => c.field === "amount"),
  );
  return (
    <div className="rule-builder">
      {alternatives.map((alternative, index) => (
        <div
          className="condition-alternative"
          key={alternative.id}
        >
          {index > 0 && <p className="condition-or">Ou</p>}
          {alternatives.length > 1 && (
            <div className="condition-heading">
              <h3>Alternativa {index + 1}</h3>
              <UiButton
                data-alternative={alternative.id}
                onClick={removeAlternative}
                type="button"
                variant="secondary"
              >
                Remover
              </UiButton>
            </div>
          )}
          {alternative.conditions.map((condition) => (
            <div
              className="condition-row"
              key={condition.id}
            >
              <ConditionSelect
                alternative={alternative.id}
                change={onCondition}
                condition={condition.id}
                items={conditionFields}
                label="Campo"
                part="field"
                value={condition.field}
              />
              <ConditionSelect
                alternative={alternative.id}
                change={onCondition}
                condition={condition.id}
                items={operatorsByField[condition.field] ?? equalsOnly}
                label="Operador"
                part="operator"
                value={condition.operator}
              />
              <ConditionValue
                accounts={accounts}
                alternative={alternative.id}
                change={onCondition}
                condition={condition}
                label={
                  condition.field === "amount"
                    ? `Valor em ${currency || "moeda a escolher"}`
                    : "Valor"
                }
                snapshot={snapshot}
              />
              <UiButton
                aria-label="Remover condição"
                className="icon-button"
                data-alternative={alternative.id}
                data-condition={condition.id}
                disabled={alternative.conditions.length === 1}
                onClick={removeCondition}
                type="button"
                variant="secondary"
              >
                <TrashIcon size={18} />
              </UiButton>
            </div>
          ))}
          <UiButton
            data-alternative={alternative.id}
            disabled={alternative.conditions.length >= 8}
            onClick={addCondition}
            type="button"
            variant="secondary"
          >
            <PlusIcon size={18} />E também
          </UiButton>
        </div>
      ))}
      <div className="rule-builder-actions">
        <UiButton
          disabled={alternatives.length >= 4}
          onClick={addAlternative}
          type="button"
          variant="secondary"
        >
          <PlusIcon size={18} />
          Ou então
        </UiButton>
        {(comparesAmount || !!currency) && (
          <Select
            className="w-full"
            items={[
              { label: "Todas as moedas", value: "" },
              ...currencies.map((value) => ({ label: value, value })),
            ]}
            label="Moeda"
            name="currency"
            onValueChange={onCurrency}
            value={currency}
          />
        )}
      </div>
    </div>
  );
}

function ConditionSelect({
  alternative,
  condition,
  part,
  change,
  ...props
}: {
  alternative: string;
  condition: string;
  part: string;
  change: Change;
  items: Options;
  label: string;
  value: string;
}) {
  const select = useCallback(
    (value: string | null) => change(alternative, condition, part, value ?? ""),
    [alternative, condition, part, change],
  );
  return (
    <Select
      className="w-full"
      {...props}
      onValueChange={select}
    />
  );
}

function ConditionValue({
  label,
  alternative,
  condition,
  accounts,
  snapshot,
  change,
}: {
  alternative: string;
  condition: DraftCondition;
  accounts: Accounts;
  snapshot: PortalResponse;
  label: string;
  change: Change;
}) {
  const onInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      change(alternative, condition.id, "value", event.currentTarget.value),
    [alternative, condition.id, change],
  );
  const onSelect = useCallback(
    (value: string | null) =>
      change(alternative, condition.id, "value", value ?? ""),
    [alternative, condition.id, change],
  );
  const options: Record<string, { id: string; name: string }[]> = {
    accountId: accounts.map((account) => ({
      id: account.id,
      name: `${account.name} · ${account.personName}`,
    })),
    direction: [
      { id: TransactionDirection.DEBIT, name: "Saída" },
      { id: TransactionDirection.CREDIT, name: "Entrada" },
    ],
    personId: snapshot.people,
    status: [
      { id: TransactionStatus.POSTED, name: "Confirmada" },
      { id: TransactionStatus.PENDING, name: "Pendente" },
    ],
  };
  const choices = options[condition.field];
  if (choices) {
    return (
      <Select
        className="w-full"
        items={[
          { label: "Selecione", value: "" },
          ...choices.map((choice) => ({
            label: choice.name,
            value: choice.id,
          })),
        ]}
        label={label}
        onValueChange={onSelect}
        required
        value={condition.value}
      />
    );
  }
  const numeric =
    condition.field === "amount" || condition.field === "receiverDocument";
  return (
    <Input
      id={`condition-${condition.id}`}
      inputMode={numeric ? "decimal" : "text"}
      label={label}
      maxLength={160}
      onChange={onInput}
      placeholder={valuePlaceholders[condition.field] ?? "Texto literal"}
      required
      type={condition.field === "date" ? "date" : "text"}
      value={condition.value}
    />
  );
}
