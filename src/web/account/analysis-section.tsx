import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { type ReactNode, useId } from "react";

import { InfoTip } from "./info-tip";

// Section titles sit outside their surface on every financial page.
export function AnalysisSection({
  title,
  currency,
  hint,
  children,
}: {
  title: string;
  currency?: string;
  hint: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="analysis-section"
    >
      <header className="section-heading analysis-heading">
        <h2 id={id}>{title}</h2>
        <span className="analysis-heading-tools">
          {currency}
          <InfoTip label={title}>{hint}</InfoTip>
        </span>
      </header>
      <LayerCard className="analysis-card">{children}</LayerCard>
    </section>
  );
}
