import {
  ArrowsClockwiseIcon,
  BankIcon,
  FoldersIcon,
  HouseIcon,
  ListChecksIcon,
  ListIcon,
  PaletteIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useCallback } from "react";

import type { PortalResponse } from "../../contracts";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { AuditView } from "./audit-view";
import { DesignSystemView } from "./design-system-view";
import { OrganizationView } from "./organization-view";
import { SyncHistoryView } from "./sync-history-view";
import { TransactionsView } from "./transactions-view";
import { WorkspaceDrawer } from "./workspace-drawer";
import { scopedHref } from "./workspace-resource";

const pages = [
  {
    icon: ShieldCheckIcon,
    name: "Auditoria MCP",
    path: "/account/audit",
  },
  {
    icon: HouseIcon,
    name: "Visão geral",
    path: "/account",
  },
  {
    icon: ReceiptIcon,
    name: "Transações",
    path: "/account/transactions",
  },
  {
    icon: ListChecksIcon,
    name: "Regras",
    path: "/account/rules",
  },
  {
    icon: FoldersIcon,
    name: "Grupos",
    path: "/account/groups",
  },
  {
    icon: ArrowsClockwiseIcon,
    name: "Sincronizações",
    path: "/account/sync",
  },
  {
    icon: BankIcon,
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
  route,
}: {
  route: string;
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
        key={route}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/rules" || path === "/account/groups") {
    content = (
      <OrganizationView
        api={api}
        key={route}
        page={path.endsWith("rules") ? "rules" : "groups"}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/sync") {
    content = (
      <SyncHistoryView
        api={api}
        key={route}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/audit") {
    content = (
      <AuditView
        api={api}
        key={route}
        snapshot={snapshot}
      />
    );
  }
  if (path === "/account/design-system") {
    content = <DesignSystemView key={route} />;
  }
  const navigation = (
    <>
      <nav
        aria-label="Páginas do Caderninho"
        className="workspace-nav"
      >
        {pages.map((p) => (
          <a
            aria-current={path === p.path ? "page" : undefined}
            aria-label={p.name}
            className="sidebar-control"
            href={scopedHref(p.path, params)}
            key={p.path}
            title={p.name}
          >
            <p.icon
              aria-hidden="true"
              size={20}
            />
            <span className="nav-label">{p.name}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-session">
        <a
          aria-current={path === "/account/design-system" ? "page" : undefined}
          aria-label="Referência visual"
          className="sidebar-control design-reference-link"
          href="/account/design-system"
        >
          <PaletteIcon
            aria-hidden="true"
            size={20}
          />
          <span className="nav-label">Referência visual</span>
        </a>
        <UiButton
          aria-label="Sair"
          className="sidebar-control"
          disabled={busy}
          onClick={logout}
          type="button"
          variant="secondary"
        >
          <SignOutIcon
            aria-hidden="true"
            size={20}
          />
          <span className="nav-label">Sair</span>
        </UiButton>
        <p>
          Instalação privada
          <br />
          <small>
            {snapshot.people.length} pessoas · {snapshot.connections.length}{" "}
            conexões
          </small>
        </p>
      </div>
    </>
  );
  return (
    <div className="workspace">
      <a
        className="skip-link"
        href="#workspace-content"
      >
        Ir para o conteúdo
      </a>
      <aside className="workspace-sidebar">
        <WorkspaceDrawer
          className="sidebar-toggle"
          side="left"
          title="Navegação"
          trigger={
            <>
              <ListIcon
                aria-hidden="true"
                size={20}
              />
              <span className="sr-only">Abrir navegação</span>
            </>
          }
        >
          {navigation}
        </WorkspaceDrawer>
        {navigation}
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
