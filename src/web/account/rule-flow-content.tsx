import { Badge } from "@cloudflare/kumo/components/badge";

import { MoneyValue } from "../money-value";
import { CategoryLabel } from "./category-appearance";
import type { RuleCompositionModel, RuleTerm } from "./rule-presentation";

function RuleConditionText({ condition }: { condition: RuleTerm }) {
  return (
    <span>
      <span className="rule-flow-field">{condition.field}</span>{" "}
      {!!condition.operator && (
        <>
          <Badge
            className="rule-flow-operator"
            variant="info"
          >
            {condition.operator}
          </Badge>{" "}
        </>
      )}
      <span
        className={
          condition.monetary
            ? "rule-flow-value rule-flow-amount"
            : "rule-flow-value"
        }
      >
        {condition.monetary ? (
          <MoneyValue value={condition.value} />
        ) : (
          condition.value
        )}
      </span>
    </span>
  );
}

export function RuleConditions({
  alternatives,
}: {
  alternatives: RuleCompositionModel["alternatives"];
}) {
  return (
    <div className="rule-flow-alternatives">
      {alternatives.map((alternative, index) => (
        <section key={alternative.id}>
          {index > 0 && <p className="rule-flow-or">Ou</p>}
          <ol className="rule-flow-conditions">
            {alternative.conditions.map((condition, position) => (
              <li key={condition.id}>
                <span className="rule-flow-join">{position ? "E" : "Se"}</span>
                <RuleConditionText condition={condition} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function RuleOutcome({ model }: { model: RuleCompositionModel }) {
  return (
    <>
      <h4>
        {model.enabled ? "Classificar como" : "Ao ativar, classificar como"}
      </h4>
      <p className="rule-flow-category">
        <CategoryLabel
          category={model.categoryAppearance}
          label={model.category || "Escolha uma categoria"}
        />
      </p>
    </>
  );
}

export const ruleNodeClass =
  "rule-flow-node rounded-md bg-kumo-base shadow ring ring-kumo-line";

export function RuleScope({ model }: { model: RuleCompositionModel }) {
  return (
    <>
      <h4>Escopo obrigatório</h4>
      <ul className="rule-flow-scope">
        {model.scope.map((condition) => (
          <li key={condition.field}>
            <RuleConditionText condition={condition} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function StaticRuleComposition({
  model,
}: {
  model: RuleCompositionModel;
}) {
  return (
    <>
      <div className="rule-flow-static rule-flow-static-narrow">
        <section className={ruleNodeClass}>
          <RuleScope model={model} />
        </section>
        <section className={ruleNodeClass}>
          <h4>
            {model.alternatives.length > 1
              ? "Alternativas (OU)"
              : "Condições (E)"}
          </h4>
          <RuleConditions alternatives={model.alternatives} />
        </section>
        <section className={ruleNodeClass}>
          <RuleOutcome model={model} />
        </section>
      </div>
      <div className="rule-flow-static rule-flow-static-wide">
        <section className={ruleNodeClass}>
          <RuleScope model={model} />
        </section>
        <div className="rule-flow-static-branches">
          {model.alternatives.map((alternative, index) => (
            <section
              className={`${ruleNodeClass} rule-flow-branch`}
              key={alternative.id}
            >
              <h4>
                {model.alternatives.length > 1
                  ? `Alternativa ${index + 1}`
                  : "Condições (E)"}
              </h4>
              <RuleConditions alternatives={[alternative]} />
            </section>
          ))}
        </div>
        <section className={ruleNodeClass}>
          <RuleOutcome model={model} />
        </section>
      </div>
    </>
  );
}
