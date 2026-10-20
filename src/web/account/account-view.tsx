import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import { createAccountApi } from "./account-api";
import { createConnectWidget } from "./connect-widget";

const runLabels = {
  failed: "Importação falhou",
  pending: "Aguardando importação",
  running: "Importando",
  succeeded: "Importação concluída",
};
function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Ainda não ocorreu";
}
function balance(value: string | null, currency: string) {
  if (value === null) {
    return "Desconhecido";
  }
  const scale =
    new Intl.NumberFormat("pt-BR", {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 0;
  const negative = value.startsWith("-");
  const digits = value.replace("-", "").padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? `,${digits.slice(-scale)}` : "";
  return `${negative ? "-" : ""}${BigInt(whole).toLocaleString("pt-BR")}${fraction} ${currency}`;
}
export function AccountView() {
  const [snapshot, setSnapshot] = useState<PortalResponse>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const [api] = useState(() => createAccountApi(location.origin));
  const [widget] = useState(createConnectWidget);
  const refresh = useCallback(
    async (signal: AbortSignal) => {
      const state = await api.read(signal);
      if (!signal.aborted) {
        setSnapshot(state);
      }
    },
    [api],
  );
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function read() {
      const { data: _data, error } = await tryCatch(() =>
        refresh(controller.signal),
      );
      if (controller.signal.aborted) {
        return;
      }
      if (error) {
        setMessage(
          "Não foi possível atualizar. Recarregue a página ou entre novamente.",
        );
      }
      timer = setTimeout(read, 5000);
    }
    background(read);
    return () => {
      controller.abort();
      clearTimeout(timer);
      lifetime.current = null;
      tryCatch(() => widget.destroy()).then(
        ({ data: _data, error: _error }) => undefined,
        () => undefined,
      );
    };
  }, [refresh, widget]);
  const command = useCallback(
    async (action: string, itemId?: string) => {
      const signal = lifetime.current?.signal;
      if (!(snapshot && signal) || locked.current) {
        return;
      }
      locked.current = true;
      setBusy(true);
      setMessage("");
      const { data: _data, error } = await tryCatch(async () => {
        await api.command(action, snapshot.csrf, signal, itemId);
        if (signal.aborted) {
          return;
        }
        if (action === "logout") {
          location.assign("/account/login");
          return;
        }
        await refresh(signal);
        setMessage(
          action === "sync"
            ? "Pedido registrado. Confira a importação e a próxima elegibilidade abaixo."
            : "Alteração salva.",
        );
      });
      if (signal.aborted) {
        return;
      }
      locked.current = false;
      setBusy(false);
      if (error) {
        setMessage(
          "Não foi possível concluir. Atualize o painel para conferir o estado antes de repetir.",
        );
      }
    },
    [snapshot, refresh, api],
  );
  const connect = useCallback(
    async (itemId?: string) => {
      const signal = lifetime.current?.signal;
      if (!(snapshot && signal) || locked.current) {
        return;
      }
      const previous = document.activeElement;
      locked.current = true;
      setBusy(true);
      setMessage("");
      let finished = false;
      let saved = false;
      const release = () => {
        if (finished || signal.aborted) {
          return false;
        }
        finished = true;
        locked.current = false;
        setBusy(false);
        if (previous instanceof HTMLElement) {
          previous.focus();
        }
        return true;
      };
      const { data: _data, error } = await tryCatch(async () => {
        const token = await api.token(snapshot.csrf, signal, itemId);
        if (signal.aborted) {
          return;
        }
        await widget.open({
          ...token,
          ...(itemId && { itemId }),
          onClose: () => {
            release();
          },
          onError: () => {
            if (release()) {
              setMessage(
                "A conexão não foi concluída. Abra novamente o Meu Pluggy.",
              );
            }
          },
          onSuccess: (id) => {
            if (saved || signal.aborted) {
              return;
            }
            saved = true;
            release();
            background(() => command("items", id));
          },
        });
      });
      if (error && release()) {
        setMessage(
          "Não foi possível abrir o Meu Pluggy. Confira as credenciais da instalação.",
        );
      }
    },
    [snapshot, command, api, widget],
  );
  const handleCommand = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const action = event.currentTarget.value;
      background(() => command(action));
    },
    [command],
  );
  const handleConnect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.value || undefined;
      background(() => connect(id));
    },
    [connect],
  );
  if (!snapshot) {
    return (
      <p role="status">
        {message || "Carregando sua instalação…"}{" "}
        <a href="/account/login">Entrar novamente</a>
      </p>
    );
  }
  return (
    <>
      <h1>Seu Caderninho</h1>
      <p>Contas e transações na sua Cloudflare.</p>
      <p
        aria-live="polite"
        role="status"
      >
        {message}
      </p>
      <section aria-labelledby="connections-heading">
        <h2 id="connections-heading">1. Conecte e importe</h2>
        {!snapshot.configured && (
          <p className="notice">
            Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets do
            Worker para conectar.
          </p>
        )}
        <UiButton
          disabled={busy || !snapshot.configured}
          onClick={handleConnect}
          type="button"
        >
          Conectar Meu Pluggy
        </UiButton>
        <UiButton
          disabled={busy || !snapshot.connections.length}
          onClick={handleCommand}
          type="button"
          value="sync"
        >
          Importar agora
        </UiButton>
        {!snapshot.connections.length && (
          <p>Nenhuma conexão. Conecte seu Meu Pluggy para começar.</p>
        )}
        <ul>
          {snapshot.connections.map((connection) => (
            <li key={connection.id}>
              <strong>{connection.name}</strong> · {connection.status}
              <br />
              {connection.partial
                ? "Importação parcial"
                : "Dados disponíveis na última importação"}
              <ul>
                {Object.entries(connection.accounts).map(([id, account]) => (
                  <li key={id}>
                    <strong>{account.name}</strong> ({account.type},{" "}
                    {account.currency})<br />
                    Saldo observado:{" "}
                    {balance(account.balanceMinor, account.currency)}
                    <br />
                    Saldo lido em: {timestamp(account.balanceObservedAt)}
                  </li>
                ))}
              </ul>
              Próxima elegibilidade: {timestamp(connection.nextImportAt)}{" "}
              <UiButton
                disabled={busy}
                onClick={handleConnect}
                type="button"
                value={connection.id}
              >
                Reconectar
              </UiButton>
            </li>
          ))}
        </ul>
        <ul>
          {snapshot.runs.slice(0, 10).map((run) => (
            <li key={run.id}>
              {runLabels[run.status]} · {run.records} registros ·{" "}
              {timestamp(run.updatedAt)}
              {!!run.error &&
                ". Confira a conexão e aguarde a próxima elegibilidade."}
            </li>
          ))}
        </ul>
        <p>
          A origem pode oferecer apenas parte do histórico. Saldo de cartão não
          é patrimônio disponível.
        </p>
      </section>
      <section aria-labelledby="assistant-heading">
        <h2 id="assistant-heading">2. Autorize seu assistente</h2>
        <p>
          Adicione esta URL como conector MCP e aprove o acesso no Caderninho:
        </p>
        <code>{snapshot.origin}/mcp</code>
        <p>
          Consulte contas, transações e totais. Autorize cada assistente com seu
          OAuth pessoal.
        </p>
      </section>
      <section aria-labelledby="maintenance-heading">
        <h2 id="maintenance-heading">3. Mantenha seu acesso</h2>
        <p>
          {snapshot.enabled
            ? "Importação diária habilitada. A pausa impede novas importações."
            : "Novas importações estão pausadas."}{" "}
          Importações já iniciadas continuam.
        </p>
        <UiButton
          disabled={busy}
          onClick={handleCommand}
          type="button"
          value={snapshot.enabled ? "pause" : "resume"}
        >
          {snapshot.enabled ? "Pausar importações" : "Retomar importações"}
        </UiButton>
        <UiButton
          disabled={busy}
          onClick={handleCommand}
          type="button"
          value="disconnect-assistants"
        >
          Revogar todos os assistentes
        </UiButton>
        <UiButton
          disabled={busy}
          onClick={handleCommand}
          type="button"
          value="logout"
        >
          Sair
        </UiButton>
      </section>
    </>
  );
}

// Browser callbacks have no awaiting caller; unexpected teardown failures are best effort.
function background(operation: () => Promise<void>) {
  tryCatch(operation).then(
    ({ data, error }) => (error ? undefined : data),
    () => undefined,
  );
}
