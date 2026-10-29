import type { ComponentProps } from "react";

import type { BackofficeDialogPanel } from "./backoffice-dialog-panel";
import { deferred, useShown } from "./deferred";

const Panel = deferred(
  async () => (await import("./backoffice-dialog-panel")).BackofficeDialogPanel,
);

export function BackofficeDialog(
  props: ComponentProps<typeof BackofficeDialogPanel>,
) {
  const shown = useShown(props.open);
  return shown ? <Panel {...props} /> : null;
}
