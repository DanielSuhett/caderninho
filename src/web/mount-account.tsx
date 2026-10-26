import { Toasty } from "@cloudflare/kumo/components/toast";
import { TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { KumoLocaleProvider } from "@cloudflare/kumo/utils";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";

import { AccountView } from "./account";

import "./account.css";
import "./account/audit.css";
import "./account/design-system.css";

function Account(props: ComponentProps<typeof AccountView>) {
  return (
    <KumoLocaleProvider
      translations={{ layerDialog: { cancel: "Cancelar", close: "Fechar" } }}
    >
      <TooltipProvider>
        <Toasty>
          <AccountView {...props} />
        </Toasty>
      </TooltipProvider>
    </KumoLocaleProvider>
  );
}
export function mountAccount(props: ComponentProps<typeof AccountView> = {}) {
  const root = document.getElementById("account-root");
  if (root) {
    createRoot(root).render(<Account {...props} />);
  }
}
