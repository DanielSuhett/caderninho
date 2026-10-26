import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Toolbar } from "@cloudflare/kumo/components/toolbar";
import { type ReactNode, useState } from "react";

import { UiButton } from "../ui";
import { WorkspaceDialog } from "./workspace-dialog";

export function FilterDialog({
  title,
  trigger,
  children,
  formId,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  formId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root
      onOpenChange={setOpen}
      open={open}
    >
      <Dialog.Trigger render={<Toolbar.Button type="button" />}>
        {trigger}
      </Dialog.Trigger>
      <WorkspaceDialog
        actions={
          <>
            <Dialog.Close
              render={
                <UiButton
                  type="button"
                  variant="secondary"
                />
              }
            >
              Cancelar
            </Dialog.Close>
            <UiButton
              form={formId}
              type="submit"
              variant="primary"
            >
              Aplicar filtros
            </UiButton>
          </>
        }
        closeLabel="Fechar filtros"
        title={title}
      >
        {children}
      </WorkspaceDialog>
    </Dialog.Root>
  );
}
