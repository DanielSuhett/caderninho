import { type ChangeEvent, useCallback, useState } from "react";

import {
  RuleOperator,
  ruleMatches,
  TransactionDirection,
  TransactionStatus,
} from "../domain";
import { RuleFlow } from "./account/rule-flow";
import { StaticRuleComposition } from "./account/rule-flow-content";
import {
  buildRuleComposition,
  type RuleSource,
} from "./account/rule-presentation";
import { formatBalance } from "./money";

const rule = {
  accountId: null,
  direction: TransactionDirection.DEBIT,
  filter: {
    alternatives: [
      {
        conditions: [
          {
            field: "description",
            operator: RuleOperator.contains,
            value: "mercado",
          },
          { field: "amount", operator: RuleOperator.gte, value: "10000" },
        ],
      },
      {
        conditions: [
          {
            field: "description",
            operator: RuleOperator.contains,
            value: "feira",
          },
        ],
      },
    ],
    currency: "BRL",
  },
  text: "",
} satisfies RuleSource;

const examples = [
  { amountMinor: "-73185", description: "Mercado da semana", id: "market" },
  { amountMinor: "-32476", description: "Feira do bairro", id: "fair" },
  { amountMinor: "-4500", description: "Mercado expresso", id: "small" },
  {
    amountMinor: "-7850",
    description: "Restaurante do bairro",
    id: "restaurant",
  },
] as const;
const model = buildRuleComposition({
  accounts: [],
  category: "Mercado",
  enabled: true,
  people: [],
  rule,
});

export function LandingRuleExample({
  interactive = false,
  wide = false,
}: {
  interactive?: boolean;
  wide?: boolean;
}) {
  const [selected, setSelected] = useState<string>(examples[0].id);
  const selectExample = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelected(event.target.value);
  }, []);
  const example = examples.find((item) => item.id === selected) ?? examples[0];
  const matches = ruleMatches(
    {
      ...example,
      accountId: "landing-example",
      currency: "BRL",
      date: "2026-10-24",
      direction: TransactionDirection.DEBIT,
      personId: "landing-example",
      status: TransactionStatus.POSTED,
    },
    rule,
  );
  return (
    <div className="rule-lab">
      <div className="rule-lab-toolbar">
        <p>Compras no mercado</p>
        <span>Regra de exemplo · BRL · saídas</span>
      </div>
      <div className="rule-composition">
        {interactive ? (
          <RuleFlow
            model={model}
            wide={wide}
          />
        ) : (
          <StaticRuleComposition model={model} />
        )}
      </div>
      <div className="rule-lab-test">
        <div>
          {interactive ? (
            <label>
              Teste um lançamento
              <select
                onChange={selectExample}
                value={selected}
              >
                {examples.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.description}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>Exemplo: {example.description}</p>
          )}
          <span>{formatBalance(example.amountMinor, "BRL")}</span>
        </div>
        <p
          aria-live="polite"
          className="rule-lab-result"
          data-match={matches}
        >
          {matches ? "Corresponde à regra" : "Não corresponde"}
          <strong>{matches ? "Mercado" : "Categoria preservada"}</strong>
        </p>
      </div>
    </div>
  );
}
