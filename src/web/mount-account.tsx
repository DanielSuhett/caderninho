import { TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { KumoLocaleProvider } from "@cloudflare/kumo/utils";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";

import { AccountView, preloadCurrentPage } from "./account";
import { accountPath, workspaceHref } from "./account/account-navigation";
import { Toaster } from "./account/notify";

import "./account.css";
import "./account/audit.css";

function Account(props: ComponentProps<typeof AccountView>) {
  return (
    <KumoLocaleProvider
      translations={{ layerDialog: { cancel: "Cancelar", close: "Fechar" } }}
    >
      <TooltipProvider>
        <AccountView {...props} />
        <Toaster />
      </TooltipProvider>
    </KumoLocaleProvider>
  );
}
export function mountAccount(props: ComponentProps<typeof AccountView> = {}) {
  const root = document.getElementById("account-root");
  if (root) {
    // Sync history now lives inside Conexões; old links keep working.
    if (accountPath(location.pathname) === "/account/sync") {
      history.replaceState(
        null,
        "",
        workspaceHref(`/account/connections${location.search}`),
      );
    }
    preloadCurrentPage();
    createRoot(root).render(<Account {...props} />);
  }
}
