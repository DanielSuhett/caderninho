import { Banner } from "@cloudflare/kumo/components/banner";
import { useCallback } from "react";

import { UiButton } from "../ui";

export function WorkspacePageError() {
  const reload = useCallback(() => location.reload(), []);
  return (
    <Banner
      action={
        <UiButton
          onClick={reload}
          type="button"
          variant="secondary"
        >
          Recarregar página
        </UiButton>
      }
      description="Recarregue para obter a versão atual da interface. Seus dados salvos foram preservados."
      title="Não foi possível abrir esta página"
      variant="error"
    />
  );
}
