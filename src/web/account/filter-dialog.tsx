import { LayerDialog, Toolbar } from "@cloudflare/kumo";
import { type ReactNode, useState } from "react";

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
    <LayerDialog.Root
      onOpenChange={setOpen}
      open={open}
    >
      <LayerDialog.Trigger render={<Toolbar.Button type="button" />}>
        {trigger}
      </LayerDialog.Trigger>
      <LayerDialog.Content
        closeLabel="Fechar filtros"
        size="base"
      >
        <LayerDialog.Title>{title}</LayerDialog.Title>
        <LayerDialog.Body>{children}</LayerDialog.Body>
        <LayerDialog.Actions dismissLabel="Cancelar">
          <LayerDialog.Actions.Primary
            form={formId}
            type="submit"
          >
            Aplicar filtros
          </LayerDialog.Actions.Primary>
        </LayerDialog.Actions>
      </LayerDialog.Content>
    </LayerDialog.Root>
  );
}
