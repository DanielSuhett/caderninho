import { Banner } from "@cloudflare/kumo/components/banner";
import { Loader } from "@cloudflare/kumo/components/loader";
import { useCallback, useEffect, useRef } from "react";

import type { PortalResponse } from "../../contracts";
import { UiButton, UiLink } from "../ui";
import { AccountAvatar } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { importFailureMessage } from "./connection-journey";
import { BankStatus, bankAppearance } from "./setup-banks";

export function initialImportIds(snapshot: PortalResponse) {
  const ready = new Set(
    snapshot.profiles
      .filter((profile) => profile.enabled && profile.configured)
      .map((profile) => profile.id),
  );
  return snapshot.connections
    .filter(
      (connection) =>
        !connection.importStatus &&
        ready.has(connection.profileId ?? "default"),
    )
    .map((connection) => connection.id)
    .slice(0, 200);
}

export function SetupImport({
  snapshot,
  busy,
  command,
  complete,
  refresh,
  readError,
}: {
  snapshot: PortalResponse;
  busy: boolean;
  command: (action: string, ids?: string[]) => void;
  complete: () => void;
  refresh: () => void;
  readError: boolean;
}) {
  const requested = useRef("");
  const ids = initialImportIds(snapshot);
  const key = ids.join("\n");
  const active = snapshot.connections.some(
    (connection) =>
      connection.importStatus === "pending" ||
      connection.importStatus === "running",
  );
  const done = snapshot.connections.filter(
    (connection) => connection.importStatus === "succeeded",
  ).length;
  const failed = snapshot.connections.some(
    (connection) => connection.importStatus === "failed",
  );
  const available = snapshot.connections.some(
    (connection) =>
      connection.hasTransactions ||
      connection.lastSuccessAt ||
      connection.importStatus === "succeeded",
  );
  const retryIds = snapshot.connections
    .filter(
      (connection) =>
        connection.importStatus === "failed" &&
        (!connection.nextEligibleAt ||
          Date.parse(connection.nextEligibleAt) <= Date.now()),
    )
    .map((connection) => connection.id)
    .slice(0, 200);
  useEffect(() => {
    if (!busy && key && requested.current !== key) {
      requested.current = key;
      command("sync", key.split("\n"));
    }
  }, [busy, command, key]);
  useEffect(() => {
    if (
      !readError &&
      snapshot.connections.length &&
      snapshot.connections.every(
        (connection) => connection.importStatus === "succeeded",
      )
    ) {
      complete();
    }
  }, [complete, readError, snapshot.connections]);
  const retry = useCallback(() => {
    requested.current = "";
    const selected = ids.length ? ids : retryIds;
    if (selected.length) {
      command("sync", selected);
      return;
    }
    refresh();
  }, [command, ids, refresh, retryIds]);
  return (
    <section
      aria-labelledby="import-heading"
      className="setup-import"
    >
      <h2
        className={failed ? undefined : "sr-only"}
        id="import-heading"
      >
        {failed ? "A importação precisa de atenção" : "Importando seus bancos"}
      </h2>
      {!!(active || busy) && (
        <Loader
          aria-label="Importação em andamento"
          size="base"
        />
      )}
      <p role="status">
        {done} de {snapshot.connections.length} bancos importados
      </p>
      {available && !!(active || failed) && (
        <Banner
          description="Histórico parcial. Os dados já recebidos continuam disponíveis."
          variant="secondary"
        />
      )}
      {!available && <p>Aguardando os primeiros lançamentos.</p>}
      {readError === true && (
        <Banner
          description="Não foi possível atualizar o progresso. Os dados salvos continuam disponíveis."
          variant="error"
        />
      )}
      <ul className="setup-import-list">
        {snapshot.connections.map((connection) => {
          const appearance = bankAppearance(connection);
          const phase = connection.importCheckpoint?.phase;
          const phaseLabels = {
            accounts: "Identificando contas",
            bills: "Importando faturas",
            finish: "Concluindo",
            investments: "Importando investimentos",
            loans: "Importando empréstimos",
            transactions: "Importando transações",
          };
          return (
            <li
              className="setup-import-item"
              key={connection.id}
            >
              <div className="setup-import-row">
                <AccountAvatar account={appearance} />
                <div>
                  <strong>{appearance.name}</strong>
                  <small>
                    {connection.personName}
                    {connection.importStatus === "running" &&
                      phase &&
                      ` · ${phaseLabels[phase]}`}
                  </small>
                </div>
                <BankStatus connection={connection} />
              </div>
              {connection.importStatus === "failed" && (
                <Banner
                  description={
                    <>
                      {importFailureMessage(connection.importError)}
                      {!!connection.nextEligibleAt && (
                        <p>
                          Nova tentativa a partir de{" "}
                          {new Date(connection.nextEligibleAt).toLocaleString(
                            "pt-BR",
                          )}
                          .
                        </p>
                      )}
                    </>
                  }
                  variant="error"
                />
              )}
            </li>
          );
        })}
      </ul>
      <div className="draft-actions">
        {!(active || busy) && !!(retryIds.length || ids.length) && (
          <UiButton
            onClick={retry}
            type="button"
          >
            Tentar novamente
          </UiButton>
        )}
        {!(active || busy) && failed && available && (
          <UiButton
            onClick={complete}
            type="button"
            variant="primary"
          >
            Conectar assistente
          </UiButton>
        )}
        {available && (
          <UiLink
            href={workspaceHref("/account/transactions")}
            variant="outline"
          >
            Consultar dados disponíveis
          </UiLink>
        )}
      </div>
    </section>
  );
}
