import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";

import type { PortalResponse } from "../../contracts";
import { UiLink } from "../ui";
import { workspaceHref } from "./account-navigation";

export const SetupTask = {
  access: "access",
  bank: "bank",
  import: "import",
} as const;
export type SetupTask = (typeof SetupTask)[keyof typeof SetupTask];

export interface SetupStatus {
  detail: string;
  done: boolean;
  id: SetupTask;
  label: string;
}

// Progress is read from what D1 already holds, never from the browser.
export function setupStatus(snapshot: PortalResponse): SetupStatus[] {
  const access = snapshot.profiles.some(
    (profile) => profile.configured && profile.enabled,
  );
  const hasBank = snapshot.connections.length > 0;
  const imported = snapshot.connections.some(
    (connection) => connection.importStatus === "succeeded",
  );
  return [
    {
      detail: access
        ? "Configurado."
        : "Informe o Client ID e o Client Secret da sua aplicação Pluggy.",
      done: access,
      id: SetupTask.access,
      label: "Acesso Meu Pluggy",
    },
    {
      detail: hasBank
        ? "Pelo menos um banco autorizado."
        : "Autorize um banco por vez no Meu Pluggy.",
      done: hasBank,
      id: SetupTask.bank,
      label: "Autorizar um banco",
    },
    {
      detail: imported
        ? "Histórico importado."
        : "Traga o histórico do banco autorizado.",
      done: imported,
      id: SetupTask.import,
      label: "Importar o histórico",
    },
  ];
}

export function nextSetupTask(statuses: SetupStatus[]) {
  return statuses.find((status) => !status.done);
}

export function SetupProgress({ snapshot }: { snapshot: PortalResponse }) {
  const statuses = setupStatus(snapshot);
  const next = nextSetupTask(statuses);
  if (!next) {
    return null;
  }
  const wizard = next.id === SetupTask.import ? "import" : "bank";
  return (
    <section
      aria-labelledby="setup-progress-heading"
      className="setup-progress"
    >
      <header className="entity-panel-header">
        <h2 id="setup-progress-heading">Configure o Caderninho</h2>
        <UiLink
          href={workspaceHref(`/account/connections?wizard=${wizard}`)}
          variant="primary"
        >
          {next.id === SetupTask.import ? "Importar" : "Adicionar banco"}
        </UiLink>
      </header>
      <ol className="setup-progress-list">
        {statuses.map((status) => (
          <li
            aria-current={status.id === next.id ? "step" : undefined}
            className="setup-progress-item"
            key={status.id}
          >
            {status.done ? (
              <CheckCircleIcon
                aria-hidden
                size={20}
                weight="fill"
              />
            ) : (
              <CircleIcon
                aria-hidden
                size={20}
              />
            )}
            <div>
              <strong>{status.label}</strong>
              <small>{status.detail}</small>
            </div>
            <span className="sr-only">
              {status.done ? "Concluído" : "Pendente"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
