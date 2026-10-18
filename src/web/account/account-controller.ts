import { WizardIssue } from "#contracts/wizard.types.ts";
import { tryCatch } from "#shared/result.ts";

import {
  type AccountActions,
  type AccountApi,
  type AccountBrowser,
  type AccountState,
  type CommandContext,
  type ConnectWidget,
  LoadStatus,
} from "./account.types.ts";
import { AccountRequestError, createAccountApi } from "./account-api.ts";
import { accountBrowser } from "./account-browser.ts";
import { WIZARD_ISSUES } from "./account-model.ts";
import { createConnectWidget } from "./connect-widget.ts";

interface Session {
  lifetime: AbortController;
  request: AbortController | undefined;
  inFlight: Promise<void> | undefined;
  changed(state: AccountState): void;
}

// Owns the account interaction lifetime, not React rendering or HTTP parsing.
// State publication and command entry share the same session gate.
export function createAccountController({
  api = createAccountApi(),
  widget = createConnectWidget(),
  browser = accountBrowser,
}: {
  api?: AccountApi;
  widget?: ConnectWidget;
  browser?: AccountBrowser;
} = {}) {
  let state: AccountState = {
    snapshot: undefined,
    load: { kind: LoadStatus.loading },
    step: browser.step() ?? 1,
    message: "",
    busy: false,
  };
  let current: Session | undefined;

  function active(session: Session | undefined): session is Session {
    return !!session && session === current && !session.lifetime.signal.aborted;
  }
  function publish(session: Session, change: Partial<AccountState>) {
    if (!active(session)) {
      return;
    }
    state = { ...state, ...change };
    session.changed(state);
  }
  function selectStep(session: Session | undefined, step: number) {
    if (!active(session)) {
      return;
    }
    publish(session, { step });
    browser.selectStep(step);
  }
  function context(session: Session): CommandContext {
    if (!state.snapshot) {
      throw new AccountRequestError(WizardIssue.session);
    }
    return { csrf: state.snapshot.csrf, signal: session.lifetime.signal };
  }
  function refresh(session = current, force = false): Promise<void> {
    if (!active(session) || !browser.visible()) {
      return Promise.resolve();
    }
    if (session.inFlight && !force) {
      return session.inFlight;
    }
    session.request?.abort();
    const controller = new AbortController();
    session.request = controller;
    const read = async () => {
      const { data, error } = await tryCatch(() => api.read(controller.signal));
      if (
        !active(session) ||
        controller.signal.aborted ||
        session.request !== controller
      ) {
        return;
      }
      session.inFlight = undefined;
      if (error) {
        publish(session, {
          load: {
            kind: LoadStatus.failed,
            session: requestIssue(error) === WizardIssue.session,
          },
        });
        return;
      }
      let step = state.step;
      if (!state.snapshot) {
        if (browser.step() === undefined) {
          step = data.status.connected ? 2 : 1;
        }
      }
      publish(session, {
        snapshot: data,
        load: { kind: LoadStatus.ready },
        step,
      });
    };
    session.inFlight = read();
    return session.inFlight;
  }
  async function act(
    work: (session: Session) => Promise<void>,
    session = current,
  ) {
    if (!active(session) || state.busy) {
      return;
    }
    publish(session, { busy: true, message: "" });
    const { data: _data, error } = await tryCatch(() => work(session));
    if (error) {
      const issue = requestIssue(error);
      const help = WIZARD_ISSUES[issue];
      publish(session, {
        busy: false,
        message: `${help.title} ${help.action}`,
        ...(issue === WizardIssue.session && {
          load: { kind: LoadStatus.failed, session: true } as const,
        }),
      });
      return;
    }
    publish(session, { busy: false });
  }
  function maintain(work: (command: CommandContext) => Promise<void>) {
    return act(async (session) => {
      await work(context(session));
      publish(session, {
        message: "Pedido registrado. Seu histórico foi preservado.",
      });
      await refresh(session, true);
    });
  }
  const actions = {
    refresh: () => refresh(),
    selectStep: (step: number) => selectStep(current, step),
    connectItem(itemId?: string) {
      const restoreFocus = browser.captureFocus();
      return act(async (session) => {
        const token = await api.connectToken(context(session), itemId);
        if (!active(session)) {
          return;
        }
        await widget.open({
          accessToken: token.accessToken,
          itemId,
          onSuccess(connectedId) {
            void act(async (connected) => {
              await api.connectItem(context(connected), connectedId);
              if (!active(connected)) {
                return;
              }
              await widget.destroy();
              await refresh(connected, true);
              selectStep(connected, 1);
            }, session);
          },
          onError: () =>
            publish(session, { message: WIZARD_ISSUES.unavailable.title }),
          onClose() {
            if (active(session)) {
              restoreFocus();
            }
          },
        });
      });
    },
    pauseSync: () => maintain(api.pauseSync),
    resumeSync: () => maintain(api.resumeSync),
    requestSync: () => maintain(api.requestSync),
    disconnectAssistants: () => maintain(api.disconnectAssistants),
    logout: () =>
      act(async (session) => {
        await api.logout(context(session));
        if (active(session)) {
          browser.login();
        }
      }),
    copy: (value: string) =>
      act(async (session) => {
        await browser.copy(value);
        publish(session, {
          message: "Copiado. Cole no destino indicado nesta etapa.",
        });
      }),
  } satisfies AccountActions;

  return {
    actions,
    getSnapshot: () => state,
    start(changed: (state: AccountState) => void) {
      const session: Session = {
        lifetime: new AbortController(),
        request: undefined,
        inFlight: undefined,
        changed,
      };
      current = session;
      publish(session, { busy: false });
      void refresh(session, true);
      return () => {
        if (current !== session) {
          return;
        }
        session.lifetime.abort();
        session.request?.abort();
        current = undefined;
        // A disposed view has no active command to receive teardown failures.
        void tryCatch(() => widget.destroy()).then(({ data, error }) =>
          error ? undefined : data,
        );
      };
    },
  };
}

function requestIssue(error: Error) {
  return error instanceof AccountRequestError
    ? error.issue
    : WizardIssue.unknown;
}
