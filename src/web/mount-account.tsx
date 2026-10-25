import { Toasty } from "@cloudflare/kumo/components/toast";
import { TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { KumoLocaleProvider } from "@cloudflare/kumo/utils";
import { createRoot } from "react-dom/client";

import { AccountView } from "./account";

import "./account.css";
import "./account/audit.css";
import "./account/design-system.css";

function Account() {
  return (
    <KumoLocaleProvider
      translations={{ layerDialog: { cancel: "Cancelar", close: "Fechar" } }}
    >
      <TooltipProvider>
        <Toasty>
          <AccountView />
        </Toasty>
      </TooltipProvider>
    </KumoLocaleProvider>
  );
}
const root = document.getElementById("account-root");
if (root) {
  createRoot(root).render(<Account />);
}
