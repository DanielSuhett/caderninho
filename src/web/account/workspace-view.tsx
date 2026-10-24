import { Sidebar } from "@cloudflare/kumo";
import {
  ArrowsClockwiseIcon,
  BankIcon,
  FoldersIcon,
  HouseIcon,
  ListChecksIcon,
  PaletteIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { lazy, type ReactNode, Suspense, useCallback } from "react";

import type { PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import type { createAccountApi } from "./account-api";
import { WorkspacePageError } from "./workspace-page";
import { scopedHref } from "./workspace-resource";
import { SidebarFrame, WorkspaceFrame } from "./workspace-shell";
import { WorkspaceSkeleton } from "./workspace-ui";

const OverviewView = lazy<typeof import("./overview-view").OverviewView>(
  async () => {
    const { data, error } = await tryCatch(() => import("./overview-view"));
    if (error) {
      return { default: WorkspacePageError };
    }
    return { default: data.OverviewView };
  },
);
const AuditView = lazy<typeof import("./audit-view").AuditView>(async () => {
  const { data, error } = await tryCatch(() => import("./audit-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.AuditView };
});
const DesignSystemView = lazy<
  typeof import("./design-system-view").DesignSystemView
>(async () => {
  const { data, error } = await tryCatch(() => import("./design-system-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.DesignSystemView };
});
const OrganizationView = lazy<
  typeof import("./organization-view").OrganizationView
>(async () => {
  const { data, error } = await tryCatch(() => import("./organization-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.OrganizationView };
});
const SyncHistoryView = lazy<
  typeof import("./sync-history-view").SyncHistoryView
>(async () => {
  const { data, error } = await tryCatch(() => import("./sync-history-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.SyncHistoryView };
});
const TransactionsView = lazy<
  typeof import("./transactions-view").TransactionsView
>(async () => {
  const { data, error } = await tryCatch(() => import("./transactions-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.TransactionsView };
});
const pages = [
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
  { icon: ShieldCheckIcon, name: "Auditoria MCP", path: "/account/audit" },
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
  const logout = useCallback(() => command("logout"), [command]);
  let content = children;
  if (
    path === "/account" &&
    snapshot.connections.some(
      (connection) => connection.hasTransactions || connection.lastSuccessAt,
    )
  ) {
    content = (
      <OverviewView
        api={api}
        key={route}
        snapshot={snapshot}
      />
    );
  }
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
  return (
    <WorkspaceFrame
      navigation={
        <WorkspaceNavigation
          busy={busy}
          logout={logout}
          snapshot={snapshot}
        />
      }
      route={route}
    >
      <Suspense
        fallback={<WorkspaceSkeleton />}
        key={route}
      >
        {content}
      </Suspense>
    </WorkspaceFrame>
  );
}

function WorkspaceNavigation({
  snapshot,
  busy,
  logout,
}: {
  snapshot: PortalResponse;
  busy: boolean;
  logout: () => void;
}) {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  return (
    <SidebarFrame
      brandHref="/account"
      footer={`${snapshot.people.length} ${snapshot.people.length === 1 ? "pessoa" : "pessoas"} · ${snapshot.connections.length} ${snapshot.connections.length === 1 ? "conexão" : "conexões"}`}
    >
      <Sidebar.Group>
        <Sidebar.GroupLabel>Instalação pessoal</Sidebar.GroupLabel>
        <nav aria-label="Páginas do Caderninho">
          <Sidebar.Menu>
            {pages.map((page) => (
              <Sidebar.MenuButton
                active={path === page.path}
                aria-current={path === page.path ? "page" : undefined}
                className="text-base"
                href={scopedHref(page.path, params)}
                icon={page.icon}
                key={page.path}
                tooltip={page.name}
              >
                {page.name}
              </Sidebar.MenuButton>
            ))}
          </Sidebar.Menu>
        </nav>
      </Sidebar.Group>
      <Sidebar.Group>
        <Sidebar.Menu>
          <Sidebar.MenuButton
            active={path === "/account/design-system"}
            className="text-base"
            href="/account/design-system"
            icon={PaletteIcon}
            tooltip="Referência visual"
          >
            Referência visual
          </Sidebar.MenuButton>
          <Sidebar.MenuButton
            className="text-base"
            disabled={busy}
            icon={SignOutIcon}
            onClick={logout}
            tooltip="Sair"
          >
            Sair
          </Sidebar.MenuButton>
        </Sidebar.Menu>
      </Sidebar.Group>
    </SidebarFrame>
  );
}
