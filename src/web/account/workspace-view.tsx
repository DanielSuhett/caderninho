import { type ReactNode, useCallback } from "react";

import type { PortalResponse } from "../../contracts";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { AuditView } from "./audit-view";
import { DesignSystemView } from "./design-system-view";
import { OrganizationView } from "./organization-view";
import { SyncHistoryView } from "./sync-history-view";
import { TransactionsView } from "./transactions-view";
import { scopedHref } from "./workspace-resource";

const pages = [
  {
    caption: "Acesso e uso do assistente",
    name: "Auditoria MCP",
    path: "/account/audit",
  },
  { caption: "Contas e titulares", name: "Visão geral", path: "/account" },
  {
    caption: "Seu histórico financeiro",
    name: "Transações",
    path: "/account/transactions",
  },
  {
    caption: "Condições de classificação",
    name: "Regras",
    path: "/account/rules",
  },
  { caption: "Espaços e categorias", name: "Grupos", path: "/account/groups" },
  {
    caption: "Rodadas e falhas",
    name: "Sincronizações",
    path: "/account/sync",
  },
  {
    caption: "Pessoas, perfis e acesso",
    name: "Conexões",
    path: "/account/connections",
  },
];
export function WorkspaceView({
  children,
  api,
  snapshot,
  command,
  busy,
}: {
  children: ReactNode;
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
  command: (action: string) => void;
  busy: boolean;
}) {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  const logout = useCallback(() => command("logout"), [command]);
  let content = children;
  if (path === "/account/transactions") {
    content = (
      <TransactionsView
        api={api}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/rules" || path === "/account/groups") {
    content = (
      <OrganizationView
        api={api}
        page={path.endsWith("rules") ? "rules" : "groups"}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/sync") {
    content = (
      <SyncHistoryView
        api={api}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/audit") {
    content = (
      <AuditView
        api={api}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/design-system") {
    content = <DesignSystemView />;
  }
  return (
    <div className="workspace">
      <a
        className="skip-link"
        href="#workspace-content"
      >
        Ir para o conteúdo
      </a>
      <aside className="workspace-sidebar">
        <nav
          aria-label="Páginas do Caderninho"
          className="workspace-nav"
        >
          {pages.map((p) => (
            <a
              aria-current={path === p.path ? "page" : undefined}
              href={scopedHref(p.path, params)}
              key={p.path}
              title={p.caption}
            >
              <span>{p.name}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-session">
          <a
            aria-current={
              path === "/account/design-system" ? "page" : undefined
            }
            className="design-reference-link"
            href="/account/design-system"
          >
            Referência visual
          </a>
          <p>
            Instalação privada
            <br />
            <small>
              {snapshot.people.length} pessoas · {snapshot.connections.length}{" "}
              conexões
            </small>
          </p>
          <UiButton
            disabled={busy}
            onClick={logout}
            type="button"
            variant="secondary"
          >
            Sair
          </UiButton>
        </div>
      </aside>
      <div
        className="workspace-content"
        id="workspace-content"
        tabIndex={-1}
      >
        {content}
      </div>
    </div>
  );
}
