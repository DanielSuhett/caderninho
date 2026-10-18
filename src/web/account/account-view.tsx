import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";

import type { AdmissionStatus } from "../../domain";
import {
  type AccountActions,
  type AccountState,
  type LoadState,
  LoadStatus,
} from "./account.types";
import { SYNC_PRESENTATION, supportPrompt } from "./account-presentation";

const labels = ["Conectar bancos", "Conectar assistente"];
const admissionLabels: Record<AdmissionStatus, string> = {
  cooldown: "Intervalo de 24 horas",
  eligible: "Disponível",
  paused: "Pausada",
  started: "Iniciada",
  working: "Em andamento",
};
const firstQuestion =
  "Use caderninho_setup_status e caderninho_status. Explique a cobertura, a atualização e eventuais falhas, sem apresentar saldos ou transações.";

function Action({
  children,
  onClick,
  disabled = false,
  value,
}: {
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  value?: string;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      size="lg"
      type="button"
      value={value}
      variant="secondary"
    >
      {children}
    </Button>
  );
}

export function AccountView({
  snapshot,
  load,
  step,
  message,
  busy,
  actions,
}: AccountState & { actions: AccountActions }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(step);
  const diagnostic = snapshot ? supportPrompt(snapshot.panel.support) : "";
  const origin = snapshot?.origin;
  const selectStep = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      actions.selectStep(Number(event.currentTarget.value));
    },
    [actions],
  );
  const connect = useCallback(() => actions.connectItem(), [actions]);
  const reconnect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      actions.connectItem(event.currentTarget.value);
    },
    [actions],
  );
  const connectAssistant = useCallback(() => actions.selectStep(2), [actions]);
  const copyAddress = useCallback(
    () => actions.copy(`${origin}/mcp`),
    [actions, origin],
  );
  const copyQuestion = useCallback(
    () => actions.copy(firstQuestion),
    [actions],
  );
  const copyDiagnostic = useCallback(
    () => actions.copy(diagnostic),
    [actions, diagnostic],
  );
  useEffect(() => {
    if (previous.current === step) {
      return;
    }
    previous.current = step;
    heading.current?.focus();
  }, [step]);
  if (!snapshot) {
    return (
      <>
        <h1>Seu Caderninho.</h1>
        <p role="status">
          {load.kind === LoadStatus.loading
            ? "Abrindo seu painel…"
            : "Não foi possível abrir o painel."}
        </p>
        {load.kind === LoadStatus.failed && load.session ? (
          <a href="/account/login">Entrar novamente</a>
        ) : (
          <Action onClick={actions.refresh}>Tentar novamente</Action>
        )}
      </>
    );
  }
  const { status: state } = snapshot,
    sync = SYNC_PRESENTATION[snapshot.panel.sync];
  return (
    <>
      <h1>Seu Caderninho.</h1>
      <p className="instance">{snapshot.origin}</p>
      <div className="setup-layout">
        <nav aria-label="Configuração">
          {labels.map((label, index) => (
            <button
              aria-current={step === index + 1 ? "step" : undefined}
              key={label}
              onClick={selectStep}
              type="button"
              value={index + 1}
            >
              {index + 1}. {label}
            </button>
          ))}
        </nav>
        <section>
          <h2
            ref={heading}
            tabIndex={-1}
          >
            {labels[step - 1]}
          </h2>
          {step === 1 ? (
            <>
              <p>
                Conecte seus bancos em{" "}
                <a
                  href="https://meu.pluggy.ai/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Meu Pluggy
                </a>
                . Depois, importe suas conexões aqui.
              </p>
              {state.credentials ? (
                <Action
                  disabled={busy}
                  onClick={connect}
                >
                  Abrir Meu Pluggy
                </Action>
              ) : (
                <p role="alert">
                  Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets
                  deste Worker na sua Cloudflare.
                </p>
              )}
              {state.connected ? (
                <>
                  <h3>{sync.title}</h3>
                  <p>{sync.detail}</p>
                  <p>
                    Cobertura: {state.coverage.complete} de{" "}
                    {state.coverage.total} recursos.
                  </p>
                  <Action onClick={connectAssistant}>
                    Conectar meu assistente
                  </Action>
                </>
              ) : null}
            </>
          ) : (
            <>
              <p>
                Adicione este endereço como servidor MCP no ChatGPT ou Claude.
                Entre com sua senha e confirme a autorização nesta instalação.
              </p>
              <label htmlFor="mcp-url">Endereço do seu MCP</label>
              <Input
                id="mcp-url"
                readOnly
                value={`${snapshot.origin}/mcp`}
              />
              <Action onClick={copyAddress}>Copiar endereço</Action>
              <details>
                <summary>Conectar no ChatGPT</summary>
                <p>
                  Nas configurações de apps/conectores, adicione um servidor MCP
                  remoto com este endereço e autenticação OAuth.
                </p>
              </details>
              <details>
                <summary>Conectar no Claude</summary>
                <p>
                  Em Configurações → Conectores, adicione um conector
                  personalizado com este endereço e autenticação OAuth.
                </p>
              </details>
              <label htmlFor="first-question">Primeira consulta</label>
              <textarea
                id="first-question"
                readOnly
                value={firstQuestion}
              />
              <Action onClick={copyQuestion}>Copiar primeira pergunta</Action>
              <p>
                Confira a resposta no seu assistente para confirmar a conexão e
                a cobertura dos dados.
              </p>
            </>
          )}
          <p role="status">{verificationMessage(load, snapshot.checkedAt)}</p>
          {load.kind === LoadStatus.failed && load.session && (
            <a href="/account/login">Entrar novamente</a>
          )}
          <p role="status">{message}</p>
        </section>
      </div>
      <details>
        <summary>Manutenção</summary>
        {snapshot.items.map((item) => (
          <p key={item.id}>
            <code>{item.id}</code>
            <Action
              disabled={busy}
              onClick={reconnect}
              value={item.id}
            >
              Reconectar
            </Action>
          </p>
        ))}
        <Action
          disabled={busy}
          onClick={actions.requestSync}
        >
          Sincronizar agora
        </Action>
        <p>
          Próxima tentativa automática:{" "}
          {snapshot.freshness?.nextAutomaticAt ?? "09:00 UTC diariamente"}.
        </p>
        {snapshot.freshness?.items.map((item) => (
          <p key={item.id}>
            <code>{item.id}</code>:{" "}
            {item.status ? admissionLabels[item.status] : "Estado indisponível"}
            . Última importação {item.lastImportAt ?? "ainda não concluída"}.
            próxima elegibilidade {item.nextEligibleAt ?? "imediata"}.
          </p>
        ))}
        {snapshot.localApplications?.map((application) => (
          <p key={application.operationId}>
            Reaplicação parcial: {application.totalProcessed} transações
            confirmadas. Solicite a continuação pelo assistente; fechar este
            painel mantém os lotes já aplicados.
          </p>
        ))}
        <Action
          disabled={busy}
          onClick={state.paused ? actions.resumeSync : actions.pauseSync}
        >
          {state.paused ? "Retomar sincronização" : "Pausar sincronização"}
        </Action>
        <p>
          A cópia é atualizada diariamente, com reconciliação semanal. Pausar
          preserva o histórico e deixa operações iniciadas terminarem. Pedidos
          manuais compartilham o intervalo mínimo de 24 horas por conexão. A
          agenda roda às 09:00 UTC. Uma importação manual pode fazer o próximo
          horário automático pular um dia. Sincronizar agora também retoma
          despachos pendentes.
        </p>
        <Action
          disabled={busy}
          onClick={actions.disconnectAssistants}
        >
          Desconectar assistentes
        </Action>
        <p>
          Para conectar novamente, refaça a autorização OAuth pelo assistente.
        </p>
        <Action
          disabled={busy}
          onClick={actions.logout}
        >
          Sair
        </Action>
      </details>
      <details>
        <summary>Diagnóstico</summary>
        <ul>
          {Object.entries(snapshot.checks).map(([name, ready]) => (
            <li key={name}>
              {checkLabel(name)}: {ready ? "Configurado" : "Requer atenção"}
            </li>
          ))}
        </ul>
        <p>
          A configuração dos recursos não comprova sua execução nem a conexão do
          assistente.
        </p>
        <textarea
          aria-label="Diagnóstico seguro"
          readOnly
          value={diagnostic}
        />
        <Action onClick={copyDiagnostic}>Copiar diagnóstico</Action>
        <Action onClick={actions.refresh}>Verificar novamente</Action>
      </details>
      <details>
        <summary>Onde seus dados ficam</summary>
        <p>
          As credenciais Pluggy ficam nos secrets do seu Worker. O histórico
          financeiro fica no D1 da sua Cloudflare. As consultas autorizadas são
          enviadas ao serviço do seu assistente.
        </p>
      </details>
    </>
  );
}

function checkLabel(name: string) {
  switch (name) {
    case "database":
      return "Banco";
    case "workflow":
      return "Importação";
    case "oauth":
      return "OAuth";
    default:
      return "Estrutura do banco";
  }
}

function verificationMessage(load: LoadState, checkedAt: string) {
  if (load.kind !== LoadStatus.failed) {
    return `Verificado em ${checkedAt}`;
  }
  if (load.session) {
    return "Sua sessão expirou. Entre novamente.";
  }
  return `Verificação indisponível. Último estado confirmado em ${checkedAt}`;
}
