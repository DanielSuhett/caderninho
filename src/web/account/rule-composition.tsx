import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { tryCatch } from "../../shared";
import type { RuleFlow } from "./rule-flow";
import { StaticRuleComposition } from "./rule-flow-content";
import { buildRuleComposition } from "./rule-presentation";

import "./rule-flow.css";

const Diagram = lazy<typeof RuleFlow>(async () => {
  const { data, error } = await tryCatch(() => import("./rule-flow"));
  if (error) {
    return { default: StaticRuleComposition };
  }
  return { default: data.RuleFlow };
});

export function RuleComposition(
  props: Parameters<typeof buildRuleComposition>[0],
) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [wide, setWide] = useState(false);
  const { rule, accounts, people, category, categoryAppearance, enabled } =
    props;
  const model = useMemo(
    () =>
      buildRuleComposition({
        accounts,
        category,
        categoryAppearance,
        enabled,
        people,
        rule,
      }),
    [rule, accounts, people, category, categoryAppearance, enabled],
  );
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setWide(entry.boundingClientRect.width >= 800);
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    const resize = new ResizeObserver(([entry]) =>
      setWide((entry?.contentRect.width ?? 0) >= 800),
    );
    resize.observe(element);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  const fallback = <StaticRuleComposition model={model} />;
  return (
    <section
      aria-label="Composição da regra"
      className="rule-composition"
      ref={root}
    >
      <p className="rule-flow-reading">
        {model.alternatives.length > 1
          ? "No escopo, qualquer alternativa (OU)."
          : "Todas as condições (E)."}
      </p>
      {visible ? (
        <Suspense fallback={fallback}>
          <Diagram
            model={model}
            wide={wide}
          />
        </Suspense>
      ) : (
        <StaticRuleComposition model={model} />
      )}
      {!model.enabled && (
        <p className="rule-flow-policy">Pausada: não será aplicada.</p>
      )}
    </section>
  );
}
