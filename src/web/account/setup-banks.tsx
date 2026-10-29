import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import {
  ArrowsClockwiseIcon,
  CaretRightIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { type MouseEvent, useCallback, useState } from "react";

import type { ConnectionInfo, HouseholdCommand } from "../../contracts";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import type { ManagementOutcome } from "./account-feedback";
import { type AccountAppearance, AccountAvatar } from "./account-identity";
import { InstitutionEditor } from "./institution-editor";
import { RowMenu } from "./row-menu";
import { finishLabel, SyncStatus } from "./sync-round";
import { momentLabel, useResource } from "./workspace-resource";

export function bankAppearance(connection: ConnectionInfo): AccountAppearance {
  const institution = Object.values(connection.accounts).find(
    (account) => account.identity?.institution,
  )?.identity?.institution;
  return {
    identity: { cardBrand: null, institution: institution ?? null },
    name: institution?.name ?? "Banco não identificado",
  };
}

export function BankStatus({ connection }: { connection: ConnectionInfo }) {
  if (connection.importStatus === "failed") {
    return <Badge variant="error">Falha</Badge>;
  }
  if (
    connection.importStatus === "pending" ||
    connection.importStatus === "running"
  ) {
    return <Badge variant="info">Importando</Badge>;
  }
  if (connection.partial && connection.importStatus) {
    return <Badge variant="warning">Parcial</Badge>;
  }
  if (!connection.importStatus) {
    return <Badge variant="warning">Não importado</Badge>;
  }
  return (
    <span className="sync-done">
      <span
        aria-hidden
        className="setup-connected"
      />
      Conectado
    </span>
  );
}

export function SetupBanks({
  connections,
  csrf,
  manage,
  institutions,
  history,
  reconnect,
}: {
  connections: ConnectionInfo[];
  csrf: string;
  institutions: ReturnType<typeof createAccountApi>["institutions"];
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
  history?: ReturnType<typeof createAccountApi>["history"];
  reconnect?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  // A link from an old sync URL opens that bank's history once.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    const linked = new URLSearchParams(window.location.search).get(
      "connectionId",
    );
    return new Set(linked ? [linked] : []);
  });
  const toggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.dataset.connection ?? "";
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);
  const open = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      setEditing(event.currentTarget.dataset.connection ?? null),
    [],
  );
  const close = useCallback(() => setEditing(null), []);
  const selectedConnection = connections.find((row) => row.id === editing);
  if (!connections.length) {
    return <p className="muted">Conecte seu primeiro banco.</p>;
  }
  return (
    <>
      {!!selectedConnection && (
        <InstitutionEditor
          close={close}
          connection={selectedConnection}
          csrf={csrf}
          institution={
            bankAppearance(selectedConnection).identity?.institution ?? null
          }
          institutions={institutions}
          manage={manage}
        />
      )}
      <LayerCard className="ledger-surface">
        <Table
          aria-label="Bancos desta pessoa"
          className="ledger-table"
          layout="fixed"
        >
          <colgroup>
            <col />
            <col className="bank-accounts-column" />
            <col className="bank-sync-column" />
            <col className="bank-status-column" />
            <col className="ledger-actions" />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>Banco</Table.Head>
              <Table.Head>Contas</Table.Head>
              <Table.Head>Última sincronização</Table.Head>
              <Table.Head>Estado</Table.Head>
              <Table.Head>
                <span className="sr-only">Ações</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          {connections.map((connection) => {
            const appearance = bankAppearance(connection);
            const accounts = Object.keys(connection.accounts).length;
            const identified = !!appearance.identity?.institution;
            const historyId = `bank-history-${connection.id}`;
            return (
              <Table.Body
                id={historyId}
                key={connection.id}
              >
                <Table.Row>
                  <Table.Cell>
                    <button
                      aria-controls={historyId}
                      aria-expanded={expanded.has(connection.id)}
                      aria-label={`Histórico de ${appearance.name}`}
                      className="ledger-primary ledger-toggle bank-toggle"
                      data-connection={connection.id}
                      onClick={toggle}
                      type="button"
                    >
                      <CaretRightIcon
                        aria-hidden
                        className="ledger-caret"
                        size={16}
                      />
                      <AccountAvatar
                        account={appearance}
                        filterable={false}
                      />
                      {appearance.name}
                    </button>
                  </Table.Cell>
                  <Table.Cell className="ledger-number">
                    {accounts} {accounts === 1 ? "conta" : "contas"}
                  </Table.Cell>
                  <Table.Cell className="ledger-muted">
                    {connection.lastSuccessAt
                      ? momentLabel(connection.lastSuccessAt)
                      : "Nunca"}
                  </Table.Cell>
                  <Table.Cell>
                    <BankStatus connection={connection} />
                    {!identified && (
                      <UiButton
                        data-connection={connection.id}
                        onClick={open}
                        type="button"
                        variant="secondary"
                      >
                        Escolher banco
                      </UiButton>
                    )}
                  </Table.Cell>
                  <Table.Cell className="ledger-actions">
                    <RowMenu
                      items={[
                        ...(identified
                          ? [
                              {
                                "data-connection": connection.id,
                                icon: <PencilSimpleIcon size={16} />,
                                key: "fix",
                                label: "Corrigir banco",
                                onClick: open,
                              },
                            ]
                          : []),
                        ...(reconnect
                          ? [
                              {
                                "data-connection": connection.id,
                                "data-profile":
                                  connection.profileId ?? "default",
                                icon: <ArrowsClockwiseIcon size={16} />,
                                key: "reconnect",
                                label: "Reautorizar banco",
                                onClick: reconnect,
                              },
                            ]
                          : []),
                      ]}
                      label={`Ações de ${appearance.name}`}
                    />
                  </Table.Cell>
                </Table.Row>
                {expanded.has(connection.id) && !!history && (
                  <BankHistory
                    connectionId={connection.id}
                    history={history}
                  />
                )}
              </Table.Body>
            );
          })}
        </Table>
      </LayerCard>
    </>
  );
}

const HISTORY_LIMIT = "10";

// Rounds load only when a bank is opened, then render as nested rows.
function BankHistory({
  connectionId,
  history,
}: {
  connectionId: string;
  history: ReturnType<typeof createAccountApi>["history"];
}) {
  const load = useCallback(
    (signal: AbortSignal, fresh = false) =>
      history(
        new URLSearchParams({ connectionId, limit: HISTORY_LIMIT }),
        signal,
        fresh,
      ),
    [connectionId, history],
  );
  const { data, error, loading } = useResource(load);
  if (!data) {
    return (
      <Table.Row className="bank-history-row">
        <Table.Cell
          className="ledger-muted bank-history-note"
          colSpan={5}
        >
          {error ? "Não foi possível carregar o histórico." : ""}
          {!error && loading && "Carregando histórico…"}
        </Table.Cell>
      </Table.Row>
    );
  }
  if (!data.records.length) {
    return (
      <Table.Row className="bank-history-row">
        <Table.Cell
          className="ledger-muted bank-history-note"
          colSpan={5}
        >
          Nenhuma sincronização registrada.
        </Table.Cell>
      </Table.Row>
    );
  }
  return data.records.map((round) => (
    <Table.Row
      className="bank-history-row"
      key={round.id}
    >
      <Table.Cell
        className="ledger-muted bank-history-note"
        colSpan={2}
      >
        <time dateTime={round.admittedAt}>{momentLabel(round.admittedAt)}</time>
      </Table.Cell>
      <Table.Cell className="ledger-muted">
        {finishLabel(round.finishedAt, round.status)}
      </Table.Cell>
      <Table.Cell>
        <SyncStatus record={round} />
      </Table.Cell>
      <Table.Cell className="ledger-actions" />
    </Table.Row>
  ));
}
