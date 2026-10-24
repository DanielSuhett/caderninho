import { Flow } from "@cloudflare/kumo/components/flow";
import { useId } from "react";

import {
  RuleConditions,
  RuleOutcome,
  RuleScope,
  ruleNodeClass,
} from "./rule-flow-content";
import type { RuleCompositionModel } from "./rule-presentation";

const padding = { x: 4, y: 8 };

export function RuleFlow({
  model,
  wide,
}: {
  model: RuleCompositionModel;
  wide: boolean;
}) {
  const id = useId();
  return (
    <div
      className="rule-flow"
      data-wide={wide}
    >
      <Flow
        align={wide ? "start" : "center"}
        canvas={false}
        orientation={wide ? "horizontal" : "vertical"}
        padding={padding}
      >
        <Flow.Node
          id={`${id}-scope`}
          render={<li className={ruleNodeClass} />}
        >
          <RuleScope model={model} />
        </Flow.Node>
        {wide && model.alternatives.length > 1 ? (
          <Flow.Parallel>
            {model.alternatives.map((alternative, index) => (
              <Flow.Node
                id={`${id}-alternative-${index}`}
                key={alternative.id}
                render={<li className={`${ruleNodeClass} rule-flow-branch`} />}
              >
                <h4>Alternativa {index + 1}</h4>
                <RuleConditions alternatives={[alternative]} />
              </Flow.Node>
            ))}
          </Flow.Parallel>
        ) : (
          <Flow.Node
            id={`${id}-conditions`}
            render={<li className={`${ruleNodeClass} rule-flow-branch`} />}
          >
            <h4>
              {model.alternatives.length > 1
                ? "Alternativas (OU)"
                : "Condições (E)"}
            </h4>
            <RuleConditions alternatives={model.alternatives} />
          </Flow.Node>
        )}
        <Flow.Node
          disabled={!model.enabled}
          id={`${id}-category`}
          render={<li className={ruleNodeClass} />}
        >
          <RuleOutcome model={model} />
        </Flow.Node>
      </Flow>
    </div>
  );
}
