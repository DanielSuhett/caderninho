import { Fragment } from "react";

import type { RuleCompositionModel } from "./rule-presentation";

const afterThousandsGroup = /(?<=\.)/u;

function RuleConditionText({
  condition,
}: {
  condition: RuleCompositionModel["alternatives"][number]["conditions"][number];
}) {
  if (!condition.amount) {
    return <span>{condition.label}</span>;
  }
  const prefix = condition.label.slice(0, -condition.amount.length);
  let length = 0;
  const groups = condition.amount.split(afterThousandsGroup).map((text) => {
    length += text.length;
    return { id: length, text };
  });
  return (
    <span>
      {prefix}
      <span className="rule-flow-amount">
        {groups.map((group) => (
          <Fragment key={group.id}>
            <span>{group.text}</span>
            <wbr />
          </Fragment>
        ))}
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
        {model.category || "Escolha uma categoria"}
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
        {model.scope.map((label) => (
          <li key={label}>{label}</li>
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
              ? "Uma destas alternativas"
              : "Todas estas condições"}
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
                  : "Todas estas condições"}
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
