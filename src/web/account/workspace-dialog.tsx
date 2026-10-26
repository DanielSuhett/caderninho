import { Dialog } from "@cloudflare/kumo/components/dialog";
import { XIcon } from "@phosphor-icons/react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { UiIconButton } from "../ui";

// Kumo 2.14 sets a fixed inline shadow. Keep its ring and use the shared theme.
const dialogElevation: CSSProperties & { "--tw-shadow": string } = {
  "--tw-shadow": "var(--shadow-dialog)",
};

// Kumo owns the modal surface. This component only arranges its content.
export function WorkspaceDialog({
  title,
  children,
  actions,
  size = "lg",
  closeLabel = "Fechar",
  busy = false,
  showClose = true,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  size?: ComponentProps<typeof Dialog>["size"];
  closeLabel?: string;
  busy?: boolean;
  showClose?: boolean;
}) {
  return (
    <Dialog
      className="workspace-dialog"
      size={size}
      style={dialogElevation}
    >
      <header className="workspace-dialog-header">
        <Dialog.Title>{title}</Dialog.Title>
        {!!showClose && (
          <Dialog.Close
            render={
              <UiIconButton
                disabled={busy}
                label={closeLabel}
                variant="ghost"
              >
                <XIcon size={20} />
              </UiIconButton>
            }
          />
        )}
      </header>
      <div className="workspace-dialog-body">{children}</div>
      {!!actions && (
        <footer className="workspace-dialog-actions">{actions}</footer>
      )}
    </Dialog>
  );
}
