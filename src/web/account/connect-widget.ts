import type { PluggyConnect } from "pluggy-connect-sdk";

import { tryCatch } from "../../shared";
import {
  ConnectFailure,
  type ConnectRequest,
  type ConnectWidget,
} from "./account.types";

type Widget = Pick<PluggyConnect, "init" | "destroy">;
interface WidgetModule {
  PluggyConnect: new (
    options: ConstructorParameters<typeof PluggyConnect>[0],
  ) => Widget;
}

const authorizationCodes = new Set([
  "ACCOUNT_CREDENTIALS_RESET",
  "ACCOUNT_LOCKED",
  "ACCOUNT_NEEDS_ACTION",
  "INVALID_CREDENTIALS",
  "INVALID_CREDENTIALS_MFA",
  "USER_AUTHORIZATION_NOT_GRANTED",
  "USER_AUTHORIZATION_PENDING",
]);
const unavailableCodes = new Set(["CONNECTION_ERROR", "SITE_NOT_AVAILABLE"]);

// Only the failure class leaves the adapter; vendor messages may carry user data.
export function classifyConnectError(error: {
  message: string;
  data?: { item: { error?: { code: string } | null } };
}): ConnectFailure {
  if (error.message.includes("ITEM_USER_ALREADY_EXISTS")) {
    return ConnectFailure.Duplicate;
  }
  const code = error.data?.item.error?.code ?? "";
  if (authorizationCodes.has(code)) {
    return ConnectFailure.Authorization;
  }
  if (unavailableCodes.has(code)) {
    return ConnectFailure.Unavailable;
  }
  return ConnectFailure.Other;
}

// All vendor lifecycle and events stop at this adapter. Generation checks also
// cover an SDK import or initialization that resolves after disposal.
export function createConnectWidget(
  load: () => Promise<WidgetModule> = () => import("pluggy-connect-sdk"),
): ConnectWidget {
  let current: Widget | undefined;
  let generation = 0;
  let cleanup: Promise<void> = Promise.resolve();
  const destroy = async () => {
    generation += 1;
    const previous = current;
    current = undefined;
    const pending = cleanup.then(async () => {
      if (previous) {
        await previous.destroy();
      }
    });
    // A failed teardown is reported to its caller without poisoning later opens.
    cleanup = tryCatch(pending).then(({ data, error }) =>
      error ? undefined : data,
    );
    await pending;
  };
  return {
    destroy,
    async open(request: ConnectRequest) {
      const closing = destroy();
      const version = generation;
      await closing;
      if (version !== generation) {
        return;
      }
      const { PluggyConnect: Widget } = await load();
      if (version !== generation) {
        return;
      }
      const instance = new Widget({
        connectToken: request.accessToken,
        ...request.configuration,
        language: "pt",
        ...(request.itemId !== undefined && { updateItem: request.itemId }),
        onClose: () => {
          if (version === generation) {
            request.onClose();
          }
        },
        onError: (reason) => {
          if (version === generation) {
            request.onError(classifyConnectError(reason));
          }
        },
        onSuccess: (result) => {
          if (version === generation) {
            request.onSuccess(result.item.id);
          }
        },
      });
      current = instance;
      const { data: _data, error } = await tryCatch(() => instance.init());
      if (version !== generation) {
        return;
      }
      if (error) {
        await destroy();
        throw error;
      }
    },
  };
}
