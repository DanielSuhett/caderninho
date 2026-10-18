import { useCallback, useEffect, useRef, useState } from "react";

import type { AccountResponse } from "#contracts/portal-contract.ts";
import { tryCatch } from "#shared/result.ts";

import { AccountRequestError, createAccountApi } from "./account-api.ts";
import {
  type AccountActions,
  type AccountState,
  type LoadState,
  missionStates,
  preserveEvidence,
  WIZARD_ISSUES,
} from "./account-model.ts";
import { createConnectWidget } from "./connect-widget.ts";

export function useAccount(): AccountState & { actions: AccountActions } {
  const [api] = useState(createAccountApi);
  const [widget] = useState(createConnectWidget);
  const [snapshot, setSnapshot] = useState<AccountResponse>();
  const snapshotRef = useRef<AccountResponse | undefined>(undefined);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [mission, setMission] = useState(() =>
    Math.min(
      5,
      Math.max(
        1,
        Math.trunc(
          Number(new URLSearchParams(location.search).get("mission")),
        ) || 1,
      ),
    ),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [watchUntil, setWatchUntil] = useState(0);
  const cursor = useRef<string | undefined>(undefined);
  const initialized = useRef(false);
  const lifetime = useRef<AbortController | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const inFlight = useRef<Promise<void> | undefined>(undefined);
  const working = useRef(false);

  const refresh = useCallback(
    (force = false): Promise<void> => {
      if (
        !lifetime.current ||
        lifetime.current.signal.aborted ||
        document.hidden
      )
        return Promise.resolve();
      if (inFlight.current && !force) return inFlight.current;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const read = async () => {
        const result = await tryCatch(
          api.read(controller.signal, cursor.current),
        );
        if (controller.signal.aborted || request.current !== controller) return;
        inFlight.current = undefined;
        if (result.error) {
          setLoad({
            kind: "failed",
            session:
              result.error instanceof AccountRequestError &&
              result.error.issue === "session",
          });
          return;
        }
        if (!initialized.current) {
          initialized.current = true;
          if (!new URLSearchParams(location.search).has("mission")) {
            const first = missionStates(result.data.data.status).findIndex(
              (done) => !done,
            );
            setMission(first < 0 ? 5 : first + 1);
          }
        }
        const next = preserveEvidence(result.data, snapshotRef.current);
        snapshotRef.current = next;
        setSnapshot(next);
        setLoad({ kind: "ready" });
      };
      inFlight.current = read();
      return inFlight.current;
    },
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void refresh(true);
    return () => {
      controller.abort();
      request.current?.abort();
      inFlight.current = undefined;
      void tryCatch(widget.destroy());
    };
  }, [refresh, widget]);

  const pending =
    snapshot &&
    !snapshot.data.status.wizard.paused &&
    ["waiting", "working"].includes(snapshot.data.status.wizard.sync);
  const expired = load.kind === "failed" && load.session;
  useEffect(() => {
    if (expired) return;
    const tick = () => {
      if (pending || Date.now() < watchUntil) void refresh();
    };
    const timer = setInterval(tick, load.kind === "failed" ? 30000 : 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, pending, watchUntil, expired, load.kind]);

  function selectMission(next: number) {
    setMission(next);
    history.replaceState(null, "", "/account?mission=" + next);
  }
  function context() {
    if (
      !snapshotRef.current ||
      !lifetime.current ||
      lifetime.current.signal.aborted
    )
      throw new AccountRequestError("session");
    return { csrf: snapshotRef.current.csrf, signal: lifetime.current.signal };
  }
  async function act(work: () => Promise<void>) {
    if (working.current || !lifetime.current || lifetime.current.signal.aborted)
      return;
    const active = lifetime.current;
    working.current = true;
    setBusy(true);
    setMessage("");
    const result = await tryCatch(work());
    working.current = false;
    if (active.signal.aborted) return;
    setBusy(false);
    if (result.error) {
      const issue =
        result.error instanceof AccountRequestError
          ? result.error.issue
          : "unknown";
      const help = WIZARD_ISSUES[issue];
      setMessage(help.title + " " + help.action);
      if (issue === "session") setLoad({ kind: "failed", session: true });
    }
  }
  function maintain(work: () => Promise<void>) {
    void act(async () => {
      await work();
      if (lifetime.current?.signal.aborted) return;
      setMessage("Pedido registrado. Seu histórico foi preservado.");
      await refresh(true);
    });
  }
  const actions: AccountActions = {
    refresh: () => {
      void refresh();
    },
    selectMission,
    saveCredentials: (credentials) => {
      void act(async () => {
        const command = context();
        await api.saveCredentials(command, credentials);
        if (command.signal.aborted) return;
        await refresh(true);
        if (!command.signal.aborted) selectMission(3);
      });
    },
    connectItem: (itemId) => {
      const opener = document.activeElement;
      const restoreFocus = () => {
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      };
      void act(async () => {
        const command = context();
        const token = await api.connectToken(command, itemId);
        if (command.signal.aborted) return;
        await widget.open({
          accessToken: token.accessToken,
          itemId,
          onSuccess: (connectedId) => {
            void act(async () => {
              await api.connectItem(context(), connectedId);
              if (command.signal.aborted) return;
              await widget.destroy();
              await refresh(true);
              if (!command.signal.aborted) selectMission(4);
            });
          },
          onError: () => setMessage(WIZARD_ISSUES.unavailable.title),
          onClose: restoreFocus,
        });
      });
    },
    pauseSync: () => maintain(() => api.pauseSync(context())),
    resumeSync: () => maintain(() => api.resumeSync(context())),
    requestSync: () => maintain(() => api.requestSync(context())),
    rotateKey: () => maintain(() => api.rotateKey(context())),
    revokeAccess: (grantId) =>
      maintain(() => api.revokeAccess(context(), grantId)),
    nextClients: (next) => {
      cursor.current = next;
      // Evidence from another page cannot be used as a fallback for this cursor.
      if (snapshotRef.current)
        snapshotRef.current = {
          ...snapshotRef.current,
          data: {
            ...snapshotRef.current.data,
            clients: [],
            status: {
              ...snapshotRef.current.data.status,
              authorized: 0,
              received: 0,
            },
          },
        };
      void refresh(true);
    },
    watchConnection: () => {
      setWatchUntil(Date.now() + 300000);
      void refresh();
    },
    copy: (value) => {
      void act(async () => {
        const active = lifetime.current;
        await navigator.clipboard.writeText(value);
        if (!active?.signal.aborted)
          setMessage("Copiado. Cole no destino indicado nesta etapa.");
      });
    },
  };
  return { snapshot, load, mission, message, busy, actions };
}
