import { Badge } from "@cloudflare/kumo/components/badge";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";

import type { ConnectionInfo } from "../../contracts";
import { UiLink } from "../ui";
import { type AccountAppearance, AccountAvatar } from "./account-identity";

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

export function SetupBanks({ connections }: { connections: ConnectionInfo[] }) {
  if (!connections.length) {
    return <p className="muted">Conecte seu primeiro banco.</p>;
  }
  return (
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
            <Tooltip
              content="Ver histórico da conexão"
              render={
                <UiLink
                  aria-label={`Ver histórico de ${appearance.name}`}
                  href={
                    "/account/sync?" +
                    new URLSearchParams({ connectionId: connection.id })
                  }
                  shape="square"
                  variant="outline"
                >
                  <ClockCounterClockwiseIcon size={20} />
                </UiLink>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
