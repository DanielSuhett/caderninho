import type { PluggyConnect } from "pluggy-connect-sdk";

import { PERSONAL_CONNECTOR_ID } from "#domain/connection-policy.ts";
import { tryCatch } from "#shared/result.ts";

interface WidgetRequest {
  accessToken: string;
  itemId: string | undefined;
  onSuccess(itemId: string): void;
  onError(): void;
  onClose(): void;
}

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
) {
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
    cleanup = tryCatch(pending).then(() => {});
    await pending;
  };
  return {
    destroy,
    async open(request: WidgetRequest) {
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
        includeSandbox: false,
        connectorIds: [PERSONAL_CONNECTOR_ID],
        selectedConnectorId: PERSONAL_CONNECTOR_ID,
        language: "pt",
        ...(request.itemId === undefined ? {} : { updateItem: request.itemId }),
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
      const initialized = await tryCatch(instance.init());
      if (version !== generation) {
        return;
      }
      if (initialized.error) {
        await destroy();
        throw initialized.error;
      }
    },
  };
}
