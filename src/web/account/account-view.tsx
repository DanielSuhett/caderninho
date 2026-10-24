import { Link } from "@cloudflare/kumo";
import { lazy, useCallback, useEffect, useRef, useState } from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { sourceIdentity } from "../../domain";
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import { createAccountApi } from "./account-api";
import {
  accountFailureMessage,
  type ManagementOutcome,
} from "./account-feedback";
import { useWorkspaceNavigation } from "./account-navigation";
import { createConnectWidget } from "./connect-widget";
import type { ConnectionActivity } from "./connection-journey";
import { createImportMonitor } from "./import-monitor";
import { WorkspacePageError } from "./workspace-page";
import { WorkspaceView } from "./workspace-view";

const DashboardView = lazy<typeof import("./dashboard-view").DashboardView>(
  async () => {
    const { data, error } = await tryCatch(() => import("./dashboard-view"));
    if (error) {
      return { default: WorkspacePageError };
    }
    return { default: data.DashboardView };
  },
);

export function AccountView() {
  const route = useWorkspaceNavigation();
  const [snapshot, setSnapshot] = useState<PortalResponse>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ConnectionActivity | null>(null);
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [readError, setReadError] = useState(false);
  const personId = new URLSearchParams(location.search).get("person") ?? "";
  const lifetime = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const snapshotFingerprint = useRef("");
  const readVersion = useRef(0);
  const schedulePoll = useRef<((active: boolean) => void) | null>(null);
  const refreshNow = useRef<(() => void) | null>(null);
  const cancelAttempt = useRef<(() => Promise<void>) | null>(null);
  const [api] = useState(() => createAccountApi(location.origin));
  const [widget] = useState(createConnectWidget);
  const refresh = useCallback(
    async (signal: AbortSignal) => {
      readVersion.current += 1;
      const version = readVersion.current;
      const state = await api.read(signal);
      if (signal.aborted || version !== readVersion.current) {
        return;
      }
      setObservedAt(new Date().toISOString());
      setReadError(false);
      const fingerprint = JSON.stringify(state);
      if (!signal.aborted && fingerprint !== snapshotFingerprint.current) {
        snapshotFingerprint.current = fingerprint;
        setSnapshot(state);
      }
      schedulePoll.current?.(
        state.connections.some(
          (c) => c.importStatus === "pending" || c.importStatus === "running",
        ),
      );
    },
    [api],
  );
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const monitor = createImportMonitor({
      failed: () => {
        setReadError(true);
      },
      read: () => refresh(controller.signal),
      visible: () => document.visibilityState === "visible",
    });
    schedulePoll.current = monitor.schedule;
    refreshNow.current = monitor.wake;
    document.addEventListener("visibilitychange", monitor.wake);
    window.addEventListener("focus", monitor.wake);
    monitor.wake();
    return () => {
      controller.abort();
      monitor.dispose();
      document.removeEventListener("visibilitychange", monitor.wake);
      window.removeEventListener("focus", monitor.wake);
      schedulePoll.current = null;
      refreshNow.current = null;
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
      // A confirmed SDK return must survive a local close releasing the UI lock.
      if (!(snapshot && signal)) {
        return;
      }
      if (action !== "items" && locked.current) {
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
        if (action === "items") {
          setMessage("");
          return;
        }
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
        await tryCatch(() => refresh(signal));
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
      const attempt = new AbortController();
      const openingSignal = AbortSignal.any([signal, attempt.signal]);
      locked.current = true;
      setBusy(true);
      setMessage("");
      setActivity({ profileId, stage: "opening" });
      let finished = false;
      let saved = false;
      const release = (restoreFocus = true) => {
        if (finished || signal.aborted) {
          return false;
        }
        finished = true;
        locked.current = false;
        setBusy(false);
        if (restoreFocus) {
          requestAnimationFrame(() => {
            if (signal.aborted) {
              return;
            }
            if (
              previous instanceof HTMLElement &&
              previous.isConnected &&
              !previous.matches(":disabled")
            ) {
              previous.focus();
            } else {
              document.getElementById("workspace-content")?.focus();
            }
          });
        }
        return true;
      };
      cancelAttempt.current = async () => {
        attempt.abort();
        const { data: _data, error } = await tryCatch(() => widget.destroy());
        if (release(!error)) {
          setActivity(null);
          setMessage(
            error
              ? "Não foi possível confirmar o fechamento da janela. Confira a conexão antes de repetir; uma autorização já enviada não foi revogada."
              : "Janela fechada. Confira o estado da conexão antes de repetir; fechar a janela não revoga uma autorização já enviada.",
          );
        }
      };
      const { data: _data, error } = await tryCatch(async () => {
        const token = await api.token(
          snapshot.csrf,
          openingSignal,
          itemId,
          profileId,
        );
        if (openingSignal.aborted || finished) {
          return;
        }
        await widget.open({
          ...token,
          ...(itemId && { itemId: sourceIdentity(itemId).upstreamId }),
          onClose: () => {
            if (release()) {
              setActivity(null);
            }
          },
          onError: () => {
            if (release()) {
              setActivity(null);
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
            background(async () => {
              // A confirmed authorization survives a later local close/cancel.
              const { data: _closed, error: closeError } = await tryCatch(() =>
                widget.destroy(),
              );
              release(!closeError);
              setActivity({ profileId, stage: "registering" });
              await command("items", { itemId: id, profileId });
              if (!signal.aborted) {
                setActivity(null);
              }
            });
          },
        });
        if (!(finished || saved || openingSignal.aborted)) {
          setActivity({ profileId, stage: "widget" });
        }
      });
      if (error && release()) {
        setActivity(null);
        setMessage(accountFailureMessage(error));
      }
    },
    [snapshot, command, api, widget],
  );
  const manage = useCallback(
    async (input: HouseholdCommand): Promise<ManagementOutcome> => {
      const signal = lifetime.current?.signal;
      if (!signal || locked.current) {
        return {
          message: "Aguarde a operação atual antes de continuar.",
          ok: false,
        };
      }
      locked.current = true;
      setBusy(true);
      setMessage("Validando e salvando…");
      const { data, error } = await tryCatch(() => api.manage(input, signal));
      if (signal.aborted) {
        return {
          message: "A página foi fechada. Confira o cadastro ao retornar.",
          ok: false,
        };
      }
      const { error: refreshError } = await tryCatch(() => refresh(signal));
      locked.current = false;
      setBusy(false);
      if (error) {
        const failureMessage = accountFailureMessage(error);
        setMessage(failureMessage);
        return { message: failureMessage, ok: false };
      }
      let savedMessage =
        input.action === "create_profile"
          ? ""
          : "Alteração salva. Titulares e origens atualizados.";
      if (refreshError) {
        savedMessage =
          "Cadastro salvo. Atualize a página para conferir a lista atualizada.";
      }
      setMessage(savedMessage);
      return {
        ok: true,
        ...("id" in data && {
          id: data.id,
          ...(data.personId && { personId: data.personId }),
        }),
      };
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
    (input: HouseholdCommand) => manage(input),
    [manage],
  );
  const onCancel = useCallback(
    () =>
      background(async () => {
        await cancelAttempt.current?.();
      }),
    [],
  );
  const onRefresh = useCallback(() => refreshNow.current?.(), []);
  if (!snapshot) {
    return (
      <div className="account-start">
        <p role="status">
          {readError
            ? "Não foi possível carregar sua instalação. Tente novamente ou entre com sua senha."
            : "Carregando sua instalação…"}
        </p>
        {readError ? (
          <p>
            <UiButton
              onClick={onRefresh}
              type="button"
              variant="secondary"
            >
              Tentar novamente
            </UiButton>{" "}
            <Link href="/account/login">Entrar novamente</Link>
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <WorkspaceView
      api={api}
      busy={busy}
      command={onCommand}
      route={route}
      snapshot={snapshot}
    >
      <DashboardView
        activity={activity}
        busy={busy}
        cancel={onCancel}
        command={onCommand}
        connect={onConnect}
        key={route}
        manage={onManage}
        message={message}
        observedAt={observedAt}
        personId={personId}
        readError={readError}
        refresh={onRefresh}
        section={
          location.pathname === "/account/connections"
            ? "connections"
            : "overview"
        }
        snapshot={snapshot}
      />
    </WorkspaceView>
  );
}

// Browser callbacks have no awaiting caller; unexpected teardown failures are best effort.
function background(operation: () => Promise<void>) {
  tryCatch(operation).then(
    ({ data, error }) => (error ? undefined : data),
    () => undefined,
  );
}
