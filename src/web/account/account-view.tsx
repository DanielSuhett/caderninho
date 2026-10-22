import { useCallback, useEffect, useRef, useState } from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { sourceIdentity } from "../../domain";
import { tryCatch } from "../../shared";
import { createAccountApi } from "./account-api";
import { createConnectWidget } from "./connect-widget";
import { DashboardView } from "./dashboard-view";

export function AccountView() {
  const [snapshot, setSnapshot] = useState<PortalResponse>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [personId, setPersonId] = useState("");
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
    async (
      action: string,
      selection: {
        itemId?: string;
        profileId?: string;
        connectionIds?: string[];
      } = {},
    ) => {
      const signal = lifetime.current?.signal;
      if (!(snapshot && signal) || locked.current) {
        return;
      }
      locked.current = true;
      setBusy(true);
      setMessage("");
      const { data: _data, error } = await tryCatch(async () => {
        await api.command(action, snapshot.csrf, signal, selection);
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
    async (profileId: string, itemId?: string) => {
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
        const token = await api.token(snapshot.csrf, signal, itemId, profileId);
        if (signal.aborted) {
          return;
        }
        await widget.open({
          ...token,
          ...(itemId && { itemId: sourceIdentity(itemId).upstreamId }),
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
            background(() => command("items", { itemId: id, profileId }));
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
  const manage = useCallback(
    async (input: HouseholdCommand) => {
      const signal = lifetime.current?.signal;
      if (!signal || locked.current) {
        return;
      }
      locked.current = true;
      setBusy(true);
      setMessage("Validando e salvando…");
      const { data: _data, error } = await tryCatch(async () => {
        await api.manage(input, signal);
        await refresh(signal);
      });
      if (signal.aborted) {
        return;
      }
      locked.current = false;
      setBusy(false);
      setMessage(
        error
          ? "Não foi possível salvar. Confira os campos e as credenciais do perfil. Atualize o painel antes de repetir."
          : "Alteração salva. Titulares e origens atualizados.",
      );
    },
    [api, refresh],
  );
  const onConnect = useCallback(
    (profileId: string, id?: string) =>
      background(() => connect(profileId, id)),
    [connect],
  );
  const onCommand = useCallback(
    (action: string, ids?: string[]) =>
      background(() => command(action, { ...(ids && { connectionIds: ids }) })),
    [command],
  );
  const onManage = useCallback(
    (input: HouseholdCommand) => background(() => manage(input)),
    [manage],
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
    <DashboardView
      busy={busy}
      command={onCommand}
      connect={onConnect}
      filter={setPersonId}
      manage={onManage}
      message={message}
      personId={personId}
      snapshot={snapshot}
    />
  );
}

// Browser callbacks have no awaiting caller; unexpected teardown failures are best effort.
function background(operation: () => Promise<void>) {
  tryCatch(operation).then(
    ({ data, error }) => (error ? undefined : data),
    () => undefined,
  );
}
