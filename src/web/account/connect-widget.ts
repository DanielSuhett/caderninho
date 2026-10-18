import type { PluggyConnect } from "pluggy-connect-sdk";

import { tryCatch } from "@/shared/result";

import type { ConnectRequest, ConnectWidget } from "./account.types";

type Widget = Pick<PluggyConnect, "init" | "destroy">;
type WidgetModule = {
  PluggyConnect: new (
    options: ConstructorParameters<typeof PluggyConnect>[0],
  ) => Widget;
};

// All vendor lifecycle and events stop at this adapter. Generation checks also
// cover an SDK import or initialization that resolves after disposal.
export function createConnectWidget(
  load: () => Promise<WidgetModule> = () => import("pluggy-connect-sdk"),
): ConnectWidget {
  let current: Widget | undefined;
  let generation = 0;
  let cleanup: Promise<void> = Promise.resolve();
  const destroy = async () => {
    generation++;
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
        onSuccess: (result) => {
          if (version === generation) {
            request.onSuccess(result.item.id);
          }
        },
        onError: () => {
          if (version === generation) {
            request.onError();
          }
        },
        onClose: () => {
          if (version === generation) {
            request.onClose();
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
