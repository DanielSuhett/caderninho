import {
  Badge,
  Banner,
  LayerCard,
  Link,
  Loader,
  Select,
} from "@cloudflare/kumo";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import type { ConnectionInfo, PortalResponse } from "../../contracts";
import { UiButton, UiLink } from "../ui";
import { DisclosureItem } from "./disclosure-item";
import { momentLabel } from "./workspace-resource";

export interface ConnectionActivity {
  profileId: string;
  stage: "opening" | "widget" | "registering";
}
const phases = {
  accounts: "Identificando contas",
  bills: "Importando faturas",
  finish: "Concluindo importação",
  investments: "Importando investimentos",
  loans: "Importando empréstimos",
  transactions: "Importando transações",
};
export function journeyConnection(connections: ConnectionInfo[]) {
  const recent = connections.toSorted((a, b) =>
    (b.lastSuccessAt ?? "").localeCompare(a.lastSuccessAt ?? ""),
  );
  return (
    connections.find(
      (c) => c.importStatus === "pending" || c.importStatus === "running",
    ) ??
    recent.find((c) => c.hasTransactions || c.lastSuccessAt) ??
    recent[0]
  );
}
function journeyTitle(
  snapshot: PortalResponse,
  connection: ConnectionInfo | undefined,
  activity: ConnectionActivity | null,
) {
  if (activity) {
    return {
      opening: "Abrindo Meu Pluggy…",
      registering: "Registrando primeira importação…",
      widget: "Autorize seu banco no Meu Pluggy",
    }[activity.stage];
  }
  if (connection?.importStatus) {
    return {
      failed: "A importação precisa de atenção",
      pending: "Importação na fila",
      running: "Importando seus dados",
      succeeded: "Importação concluída",
    }[connection.importStatus];
  }
  if (connection) {
    return "Primeira importação pendente";
  }
  if (snapshot.configured) {
    return "Conecte seu primeiro banco";
  }
  return snapshot.profiles.some((p) => !p.enabled)
    ? "Perfis pausados ou sem configuração"
    : "Configure seu perfil Pluggy";
}
function OpeningJourney({
  activity,
  snapshot,
  cancel,
}: {
  activity: ConnectionActivity;
  snapshot: PortalResponse;
  cancel: () => void;
}) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (activity.stage !== "opening") {
      return;
    }
    const timer = setTimeout(() => setDelayed(true), 15_000);
    return () => clearTimeout(timer);
  }, [activity.stage]);
  const profile = snapshot.profiles.find((p) => p.id === activity.profileId);
  const owner = snapshot.people.find((p) => p.id === profile?.personId);
  return (
    <>
      <p className="muted">
        {owner?.name} · {profile?.name}
      </p>
      <p>
        {activity.stage === "registering"
          ? "Conexão autorizada. Estamos confirmando o pedido de importação nesta instalação."
          : "Você escolhe o banco e autoriza a leitura na janela do Meu Pluggy."}
      </p>
      {!!delayed && activity.stage === "opening" && (
        <Banner
          className="feedback"
          description={
            <>
              O Meu Pluggy está demorando para abrir. Você pode fechar esta
              espera e tentar novamente; isso não cancela uma autorização já
              enviada.
            </>
          }
          variant="default"
        />
      )}
      {activity.stage !== "registering" && (
        <UiButton
          onClick={cancel}
          type="button"
          variant="secondary"
        >
          {activity.stage === "opening"
            ? "Fechar espera"
            : "Fechar janela do Meu Pluggy"}
        </UiButton>
      )}
    </>
  );
}
function ConnectProfile({
  snapshot,
  connect,
  manage,
}: {
  snapshot: PortalResponse;
  connect: (profileId: string) => void;
  manage: () => void;
}) {
  const ready = snapshot.profiles.filter((p) => p.enabled && p.configured);
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      connect(String(new FormData(event.currentTarget).get("profileId")));
    },
    [connect],
  );
  if (!ready.length) {
    return (
      <>
        <p>
          Reutilize as credenciais da instalação ou configure o perfil da pessoa
          que vai conectar. Seus dados existentes são preservados.
        </p>
        <UiButton
          onClick={manage}
          type="button"
        >
          Configurar ou reativar perfil
        </UiButton>
      </>
    );
  }
  return (
    <>
      <p>Você escolhe o banco e autoriza a leitura pelo Meu Pluggy.</p>
      <form
        className="journey-connect"
        onSubmit={submit}
      >
        <Select
          defaultValue={ready[0]?.id ?? ""}
          id="journey-profile"
          items={[
            ...ready.map((p) => ({
              label: (
                <>
                  {p.name} ·{" "}
                  {
                    snapshot.people.find((person) => person.id === p.personId)
                      ?.name
                  }
                </>
              ),
              value: p.id,
            })),
          ]}
          label="Perfil para conectar"
          name="profileId"
        />
        <p className="muted">Perfil configurado</p>
        <UiButton type="submit">Conectar Meu Pluggy</UiButton>
        <p>
          Depois de autorizar, a primeira importação começa automaticamente.
        </p>
      </form>
      <DisclosureItem summary={<>Como funciona a conexão</>}>
        <p>
          A autorização acontece no Meu Pluggy. O Caderninho importa uma cópia
          dos dados para esta instalação; você acompanha o pedido aqui, sem
          precisar iniciar uma segunda operação.
        </p>
      </DisclosureItem>
    </>
  );
}
function ImportProgress({
  connection,
  observedAt,
}: {
  connection: ConnectionInfo;
  observedAt: string | null;
}) {
  const phase = connection.importCheckpoint?.phase;
  const currentAccount = connection.importCheckpoint?.accountId;
  const accountName = currentAccount
    ? connection.accounts[currentAccount]?.name
    : undefined;
  const count = Object.keys(connection.accounts).length;
  return (
    <>
      <div className="journey-phase">
        <Loader
          aria-label="Importação em andamento"
          size="base"
        />
        <div>
          <h3>
            {connection.importStatus === "running" && phase
              ? phases[phase]
              : "Aguardando início da execução"}
          </h3>
          {!!accountName && <p>Recebendo dados de {accountName}.</p>}
        </div>
      </div>
      <p className="muted">
        Conexão registrada · {count}{" "}
        {count === 1 ? "conta identificada" : "contas identificadas"}
      </p>
      {!!observedAt && (
        <p className="journey-observed">
          Consultado em {momentLabel(observedAt)}.
        </p>
      )}
      <Banner
        className="feedback"
        description={
          connection.hasTransactions
            ? "Dados parciais. A importação ainda está em andamento."
            : "Aguardando os primeiros lançamentos. A importação ainda não foi concluída."
        }
        variant={
          (
            {
              error: "error",
              info: "default",
              neutral: "secondary",
              success: "secondary",
              warning: "alert",
            } as const
          )[connection.hasTransactions ? "warning" : "info"]
        }
      />
    </>
  );
}
function ImportResult({ connection }: { connection: ConnectionInfo }) {
  const count = Object.keys(connection.accounts).length;
  return (
    <>
      <p>
        {count} {count === 1 ? "conta importada" : "contas importadas"}
      </p>
      {!connection.hasTransactions && (
        <p>Nenhuma transação foi retornada nesta importação.</p>
      )}
      {connection.partial === true && (
        <Banner
          className="feedback"
          description={<>Dados parciais nesta origem.</>}
          variant="alert"
        />
      )}
    </>
  );
}
function ImportJourney({
  connection,
  observedAt,
  manage,
}: {
  connection: ConnectionInfo;
  observedAt: string | null;
  manage: () => void;
}) {
  const active =
    connection.importStatus === "running" ||
    connection.importStatus === "pending";
  const done = connection.importStatus === "succeeded";
  const partial = active || connection.importStatus === "failed";
  return (
    <>
      <p className="journey-origin">
        {connection.personName ?? "Eu"} ·{" "}
        {connection.profileName ?? "Pluggy principal"}
      </p>
      {active === true && (
        <ImportProgress
          connection={connection}
          observedAt={observedAt}
        />
      )}
      {done && <ImportResult connection={connection} />}
      {connection.importStatus === "failed" && (
        <Banner
          className="feedback"
          description={importFailureMessage(connection.importError)}
          variant="error"
        />
      )}
      {!connection.importStatus && (
        <p>
          A conexão está registrada, mas a primeira importação ainda não foi
          confirmada. Confira os detalhes para iniciar ou recuperar o pedido.
        </p>
      )}
      {(connection.hasTransactions === true || done === true) && (
        <div className="journey-result">
          <UiLink
            href={`/account/transactions?${new URLSearchParams({ ...(connection.personId && { person: connection.personId }) })}`}
            variant="primary"
          >
            {partial ? "Ver transações disponíveis" : "Ver transações"}
          </UiLink>
          {active === true && <p className="muted">A importação continua.</p>}
        </div>
      )}
      <DisclosureItem
        className="journey-details"
        summary={<>Detalhes da importação</>}
      >
        <p>Consulta à cópia importada, não ao banco ao vivo.</p>
        {!active && !!observedAt && (
          <p>Estado consultado em {momentLabel(observedAt)}.</p>
        )}
        {done && (
          <>
            <p>Concluída em {momentLabel(connection.lastSuccessAt)}.</p>
            <ul className="journey-accounts">
              {Object.entries(connection.accounts).map(([id, a]) => (
                <li key={id}>{a.name}</li>
              ))}
            </ul>
          </>
        )}
        <p>
          Próxima elegibilidade:{" "}
          {connection.nextEligibleAt
            ? momentLabel(connection.nextEligibleAt)
            : "Ainda não registrada"}
          .
        </p>
        {!!connection.importError && <p>Código: {connection.importError}.</p>}
        <Link href="/account/sync">Ver histórico de sincronizações</Link>
        {!(active || done) && (
          <p>
            <UiButton
              onClick={manage}
              type="button"
              variant="secondary"
            >
              Gerenciar conexão e importação
            </UiButton>
          </p>
        )}
      </DisclosureItem>
    </>
  );
}

export function importFailureMessage(code: string | null) {
  const causes: Record<string, string> = {
    UPSTREAM_AUTH:
      "A origem recusou o acesso. Confira o perfil e a autorização.",
    UPSTREAM_FORBIDDEN:
      "A origem recusou o acesso. Confira o perfil e a autorização.",
    UPSTREAM_RATE_LIMIT: "O provedor limitou as consultas.",
    UPSTREAM_TIMEOUT: "O provedor demorou a responder.",
    UPSTREAM_UNAVAILABLE: "O provedor está indisponível.",
  };
  const cause = (code && causes[code]) || "A importação foi interrompida.";
  return `${cause} Os dados já publicados foram preservados. Consulte os detalhes e a próxima elegibilidade antes de repetir.`;
}
export function ConnectionJourney({
  snapshot,
  activity,
  observedAt,
  readError,
  connect,
  cancel,
  manage,
}: {
  snapshot: PortalResponse;
  activity: ConnectionActivity | null;
  observedAt: string | null;
  readError: boolean;
  connect: (profileId: string) => void;
  cancel: () => void;
  manage: () => void;
}) {
  const connection = journeyConnection(snapshot.connections);
  const title = journeyTitle(snapshot, connection, activity);
  const active =
    connection?.importStatus === "running" ||
    connection?.importStatus === "pending";
  let content = (
    <ConnectProfile
      connect={connect}
      manage={manage}
      snapshot={snapshot}
    />
  );
  if (activity) {
    content = (
      <OpeningJourney
        activity={activity}
        cancel={cancel}
        key={activity.stage}
        snapshot={snapshot}
      />
    );
  } else if (connection) {
    content = (
      <ImportJourney
        connection={connection}
        manage={manage}
        observedAt={observedAt}
      />
    );
  }
  const phase = connection?.importCheckpoint?.phase;
  const announcement =
    !activity && connection?.importStatus === "running" && phase
      ? `${title}. ${phases[phase]}`
      : title;
  return (
    <LayerCard
      aria-labelledby="connection-journey-heading"
      className="connection-journey"
      render={<section />}
    >
      <p
        className="sr-only"
        role="status"
      >
        {announcement}
      </p>
      <div className="journey-heading">
        <h2 id="connection-journey-heading">{title}</h2>
        {!activity && connection?.importStatus === "succeeded" && (
          <CheckCircleIcon
            aria-hidden="true"
            className="journey-success"
            size={22}
          />
        )}
        {active && !activity && (
          <Badge variant="info">
            {connection?.importStatus === "running"
              ? "Em andamento"
              : "Na fila"}
          </Badge>
        )}
      </div>
      {content}
      {readError === true && (
        <Banner
          className="feedback"
          description={
            <>
              <p>
                Não foi possível atualizar o estado. A última observação foi
                mantida; isso não confirma falha da importação.
              </p>
              <a href="/account/login">Entrar novamente</a>
            </>
          }
          role="alert"
          variant="alert"
        />
      )}
    </LayerCard>
  );
}
