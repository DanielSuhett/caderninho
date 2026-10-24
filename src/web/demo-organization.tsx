import { useCallback, useState } from "react";

import { demoPortalFixture } from "../fixtures/workspace";
import { OrganizationView } from "./account/organization-view";
import type { createDemoSession } from "./demo-session";
import { UiButton } from "./ui";

function applicationMessage({
  changed,
  matched,
}: {
  changed: number;
  matched: number;
}) {
  if (changed) {
    return `${changed} transações atualizadas · ${matched} correspondem às regras ativas.`;
  }
  if (matched) {
    return `Nenhuma alteração: as ${matched} correspondências já tinham a categoria.`;
  }
  return "Nenhuma transação corresponde às regras ativas.";
}
const snapshot = demoPortalFixture();
export function DemoOrganization({
  session,
  page,
}: {
  session: ReturnType<typeof createDemoSession>;
  page: "rules" | "groups";
}) {
  const spaceId =
    new URLSearchParams(location.search).get("space") ?? "personal";
  const [feedback, setFeedback] = useState({ revision: -1, text: "" });
  const apply = useCallback(() => {
    const result = session.applyRules(spaceId);
    setFeedback({
      revision: session.revision(),
      text: applicationMessage(result),
    });
  }, [session, spaceId]);
  return (
    <OrganizationView
      actions={
        page === "rules" && (
          <UiButton
            disabled={!session.view(spaceId).records.length}
            onClick={apply}
            type="button"
            variant="secondary"
          >
            Reaplicar regras
          </UiButton>
        )
      }
      api={session.api}
      basePath="/demo"
      notice={
        page === "rules" && (
          <div className="demo-rule-notice">
            <p className="muted">
              Salvar não altera os lançamentos. Reaplicar atualiza todo o
              histórico fictício do grupo, exceto ignorados. Categorias sem
              correspondência são preservadas.
            </p>
            <p role="status">
              {feedback.revision === session.revision() ? feedback.text : ""}
            </p>
          </div>
        )
      }
      page={page}
      snapshot={snapshot}
    />
  );
}
