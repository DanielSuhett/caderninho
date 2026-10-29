import { Dialog } from "@cloudflare/kumo/components/dialog";
import type { ReactNode } from "react";

import { UiButton } from "../ui";
import { WorkspaceDialog } from "./workspace-dialog";

export function FilterDialogPanel({
  title,
  children,
  formId,
  open,
  setOpen,
}: {
  title: string;
  children: ReactNode;
  formId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Dialog.Root
      onOpenChange={setOpen}
      open={open}
    >
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
