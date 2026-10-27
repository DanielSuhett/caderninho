import { Badge } from "@cloudflare/kumo/components/badge";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  ClockCounterClockwiseIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { type MouseEvent, useCallback, useState } from "react";

import type { ConnectionInfo, HouseholdCommand } from "../../contracts";
import { UiIconButton, UiLink } from "../ui";
import type { createAccountApi } from "./account-api";
import type { ManagementOutcome } from "./account-feedback";
import { type AccountAppearance, AccountAvatar } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { InstitutionEditor } from "./institution-editor";

export function bankAppearance(connection: ConnectionInfo): AccountAppearance {
  const institution = Object.values(connection.accounts).find(
    (account) => account.identity?.institution,
  )?.identity?.institution;
  return {
    identity: { cardBrand: null, institution: institution ?? null },
    name: institution?.name ?? "Banco autorizado",
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
    <Tooltip
      content="Conectado · histórico importado"
      render={
        <span
          aria-label="Conectado · histórico importado"
          className="setup-connected"
          role="img"
        />
      }
    />
  );
}

export function SetupBanks({
  connections,
  csrf,
  manage,
  institutions,
}: {
  connections: ConnectionInfo[];
  csrf: string;
  institutions: ReturnType<typeof createAccountApi>["institutions"];
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const open = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
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
      <ul
        aria-label="Bancos desta pessoa"
        className="setup-banks"
      >
        {connections.map((connection) => {
          const appearance = bankAppearance(connection);
          return (
            <li
              className="setup-bank-row"
              key={connection.id}
            >
              <AccountAvatar account={appearance} />
              <strong>{appearance.name}</strong>
              <BankStatus connection={connection} />
              <div className="setup-bank-actions">
                <UiIconButton
                  data-connection={connection.id}
                  label={`Corrigir banco de ${appearance.name}`}
                  onClick={open}
                >
                  <PencilSimpleIcon size={20} />
                </UiIconButton>
                <Tooltip
                  content="Ver histórico da conexão"
                  render={
                    <UiLink
                      aria-label={`Ver histórico de ${appearance.name}`}
                      href={
                        workspaceHref("/account/sync?") +
                        new URLSearchParams({ connectionId: connection.id })
                      }
                      shape="square"
                      variant="outline"
                    >
                      <ClockCounterClockwiseIcon size={20} />
                    </UiLink>
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
