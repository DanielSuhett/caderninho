import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  type AccountState,
  type AccountActions,
  missionStates,
  supportPrompt,
  syncPresentation,
} from "./account-model.ts";

const labels = [
  "Minha instalação",
  "Validar a Pluggy",
  "Conectar meus bancos",
  "Primeira sincronização",
  "Testar no assistente",
];
const firstQuestion =
  "Use caderninho_setup_status e caderninho_status. Explique a cobertura, a atualização e eventuais falhas, sem apresentar saldos ou transações.";
function Action({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
export function AccountView({
  snapshot,
  load,
  mission,
  message,
  busy,
  actions,
}: AccountState & { actions: AccountActions }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousMission = useRef(mission);
  useEffect(() => {
    if (previousMission.current === mission) return;
    previousMission.current = mission;
    heading.current?.focus();
  }, [mission]);
  if (!snapshot)
    return (
      <>
        <h1>Sua instalação MCP.</h1>
        <p role="status">
          {load.kind === "loading"
            ? "Verificando sua instalação…"
            : "Não foi possível verificar a instalação."}
        </p>
        {load.kind === "failed" && load.session ? (
          <a href="/account/login">Renovar acesso</a>
        ) : (
          <Action onClick={actions.refresh}>Tentar novamente</Action>
        )}
      </>
    );
  const { data, account, csrf } = snapshot;
  const state = data.status.wizard;
  const done = missionStates(data.status);

  const sync = syncPresentation(state);
  return (
    <>
      <h1>Sua instalação MCP.</h1>
      <p className="instance">{snapshot.origin} · Instância pessoal</p>
      <p>
        {done.filter(Boolean).length} de 5 missões verificadas. Continue de onde
        parou.
      </p>
      <progress
        max={5}
        value={done.filter(Boolean).length}
        aria-label="Missões verificadas"
      />
      <div className="mission-layout">
        <nav aria-label="Missões da instalação">
          {labels.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => actions.selectMission(index + 1)}
              aria-current={mission === index + 1 ? "step" : undefined}
            >
              {index + 1}. {label}
              <small>{done[index] ? "Verificada" : "A verificar"}</small>
            </button>
          ))}
        </nav>
        <section>
          <h2
            ref={heading}
            tabIndex={-1}
          >
            {labels[mission - 1]}
          </h2>
          {mission === 1 && (
            <>
              <p>
                Confira os recursos desta instalação antes de conectar a Pluggy.
              </p>
              <ul>
                {[
                  {
                    name: "Endereço e dono",
                    ready: data.checks.origin && data.checks.owner,
                  },
                  {
                    name: "Banco e estrutura",
                    ready: data.checks.database && data.checks.migrations,
                  },
                  {
                    name: "Proteção das credenciais configurada",
                    ready: data.checks.vault,
                  },
                  {
                    name: "OAuth e Workflow configurados",
                    ready: data.checks.oauth && data.checks.workflow,
                  },
                ].map(({ name, ready }) => (
                  <li key={name}>
                    {name}: {ready ? "Verificado" : "Requer configuração"}
                  </li>
                ))}
              </ul>
              <p>
                Configuração presente não comprova execução do Workflow nem
                descriptografia de uma credencial. As próximas missões verificam
                o uso.
              </p>
              <Action onClick={() => actions.selectMission(2)}>
                Continuar para a Pluggy
              </Action>
            </>
          )}
          {mission === 2 && (
            <Credentials
              busy={busy}
              onSubmit={(clientId, clientSecret) =>
                actions.saveCredentials({ clientId, clientSecret })
              }
            />
          )}
          {mission === 3 && (
            <>
              <p>
                Conecte seus bancos em{" "}
                <a
                  href="https://meu.pluggy.ai/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Meu Pluggy
                </a>{" "}
                primeiro. A janela do Meu Pluggy importa suas conexões pessoais.
              </p>
              {state.credentials ? (
                <Action
                  disabled={busy}
                  onClick={() => actions.connectItem()}
                >
                  Abrir Meu Pluggy
                </Action>
              ) : (
                <Action onClick={() => actions.selectMission(2)}>
                  Validar chaves
                </Action>
              )}
            </>
          )}
          {mission === 4 && (
            <>
              <h3>{sync.title}</h3>
              <p>{sync.detail}</p>
              <p>
                Cobertura: {state.coverage.complete} de {state.coverage.total}{" "}
                recursos.
              </p>
              <Action onClick={actions.refresh}>Verificar progresso</Action>
              <Action onClick={() => actions.selectMission(5)}>
                Conectar meu assistente
              </Action>
            </>
          )}
          {mission === 5 && (
            <>
              <p>
                Conecte ChatGPT ou Claude por OAuth. Você autoriza o acesso
                aqui; suas chaves administrativas e da Pluggy não são enviadas
                ao assistente.
              </p>
              <label htmlFor="mcp-url">Endereço do seu MCP</label>
              <Input
                id="mcp-url"
                readOnly
                value={snapshot.origin + "/mcp"}
              />
              <Action onClick={() => actions.copy(snapshot.origin + "/mcp")}>
                Copiar endereço
              </Action>
              <details>
                <summary>Conectar no ChatGPT</summary>
                <p>
                  Nas configurações de apps/conectores, adicione um servidor MCP
                  remoto com este endereço. Entre nesta instância e confira o
                  destino antes de autorizar.
                </p>
              </details>
              <details>
                <summary>Conectar no Claude</summary>
                <p>
                  Em Configurações → Conectores, adicione um conector
                  personalizado com este endereço. Use OAuth e confirme o acesso
                  nesta instância.
                </p>
              </details>
              <label htmlFor="first-question">Primeira consulta</label>
              <textarea
                id="first-question"
                readOnly
                value={firstQuestion}
              />
              <Action onClick={() => actions.copy(firstQuestion)}>
                Copiar primeira pergunta
              </Action>
              <p>
                {data.status.clientsAvailable
                  ? `${data.status.authorized} autorizações nesta página · ${data.status.received} com requisição autenticada recebida`
                  : "Autorizações indisponíveis agora. Evidência anterior preservada."}
              </p>
              <p>
                Nomes são declarados pelos clientes. Uma requisição comprova o
                uso da autorização; a compatibilidade final depende do teste no
                assistente.
              </p>
              {data.clients.map((client) => (
                <article key={client.id}>
                  <strong>{client.name}</strong>
                  <p>
                    {client.receivedAt
                      ? "Requisição autenticada recebida"
                      : "Autorização concedida · aguardando requisição"}
                  </p>
                  <details>
                    <summary>Identificar e revogar acesso</summary>
                    <code>{client.clientId}</code>
                    <Action
                      disabled={busy}
                      onClick={() => actions.revokeAccess(client.id)}
                    >
                      Revogar este acesso
                    </Action>
                  </details>
                </article>
              ))}
              {data.cursor && (
                <Action
                  onClick={() => {
                    if (data.cursor) actions.nextClients(data.cursor);
                  }}
                >
                  Ver próximas autorizações
                </Action>
              )}
              <Action onClick={actions.watchConnection}>
                Acompanhar conexão por 5 minutos
              </Action>
            </>
          )}
          <p role="status">
            {load.kind === "failed"
              ? load.session
                ? "Seu acesso expirou. Entre novamente; as etapas salvas continuam aqui."
                : "Verificação indisponível. Evidência anterior preservada de " +
                  data.status.checkedAt
              : "Verificado em " + data.status.checkedAt}
          </p>
          {load.kind === "failed" && load.session && (
            <a href="/account/login">Renovar acesso</a>
          )}
          <Action onClick={actions.refresh}>
            Verificar instalação novamente
          </Action>
          <p role="status">{message}</p>
        </section>
      </div>
      <details>
        <summary>Conexões e manutenção</summary>
        {account.latest && (
          <p>
            {account.latest.phase === "error"
              ? "Falhou; consulte a cobertura antes de usar os dados"
              : account.latest.status}{" "}
            · {account.latest.updated_at}
          </p>
        )}
        <p>
          {account.config?.enabled
            ? "Novas transações diariamente; reconciliação completa semanal"
            : "Sincronização pausada"}
        </p>
        {account.items.map((item) => (
          <p key={item.id}>
            <code>{item.id}</code>
            <Action
              disabled={busy}
              onClick={() => actions.connectItem(item.id)}
            >
              Reconectar
            </Action>
          </p>
        ))}
        <Action onClick={() => actions.selectMission(3)}>
          Adicionar uma conexão
        </Action>
        <Action onClick={() => actions.selectMission(2)}>
          Renovar minhas chaves Pluggy
        </Action>
        <Action
          disabled={busy}
          onClick={actions.requestSync}
        >
          Sincronizar cópia agora
        </Action>
        <Action
          disabled={busy}
          onClick={
            account.config?.enabled ? actions.pauseSync : actions.resumeSync
          }
        >
          {account.config?.enabled
            ? "Pausar próximas sincronizações"
            : "Retomar sincronização"}
        </Action>
        <p>
          Pausar preserva o histórico e não interrompe uma operação já iniciada.
          Pedidos manuais têm intervalo mínimo de 15 minutos.
        </p>
        {snapshot.rotate && (
          <Action
            disabled={busy}
            onClick={actions.rotateKey}
          >
            Proteger credenciais com a chave atual
          </Action>
        )}
        <details>
          <summary>Diagnóstico seguro</summary>
          <textarea
            readOnly
            aria-label="Diagnóstico seguro"
            value={supportPrompt(state)}
          />
          <Action onClick={() => actions.copy(supportPrompt(state))}>
            Copiar diagnóstico
          </Action>
        </details>
        <form
          method="post"
          action="/account/logout"
        >
          <input
            type="hidden"
            name="csrf"
            value={csrf}
          />
          <Button
            type="submit"
            variant="secondary"
          >
            Sair
          </Button>
        </form>
      </details>
      <details>
        <summary>Privacidade: onde cada informação fica</summary>
        <p>
          As chaves Pluggy ficam criptografadas no banco desta instalação. O
          Worker tem a chave necessária para usá-las: isso não é criptografia de
          ponta a ponta.
        </p>
        <p>
          O histórico fica no D1 da sua conta Cloudflare. Os resultados
          consultados pelo MCP são enviados ao serviço de IA autorizado. Revogar
          acesso não apaga mensagens já enviadas.
        </p>
        <p>
          Sair encerra esta sessão. Pausar preserva o histórico. Revogar um
          cliente remove aquela autorização; são controles independentes.
        </p>
      </details>
    </>
  );
}
function Credentials({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (clientId: string, clientSecret: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [consent, setConsent] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(clientId, clientSecret);
    setClientSecret("");
  }
  return (
    <form onSubmit={submit}>
      <p>
        Abra o painel da Pluggy e use as chaves da mesma aplicação. Nunca use a
        senha do banco.
      </p>
      <label htmlFor="client-id">Client ID</label>
      <Input
        id="client-id"
        required
        autoComplete="off"
        value={clientId}
        onChange={(event) => setClientId(event.target.value)}
      />
      <label htmlFor="client-secret">Client Secret</label>
      <Input
        id="client-secret"
        required
        type="password"
        autoComplete="off"
        value={clientSecret}
        onChange={(event) => setClientSecret(event.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        Autorizo esta instalação a armazenar minhas chaves criptografadas e ler
        meus dados na Pluggy.
      </label>
      <Button
        type="submit"
        variant="secondary"
        disabled={busy || !consent}
      >
        {busy ? "Validando…" : "Validar minhas chaves"}
      </Button>
    </form>
  );
}
