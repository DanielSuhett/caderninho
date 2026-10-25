import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  ArrowsClockwiseIcon,
  BankIcon,
  CreditCardIcon,
  FoldersIcon,
  HouseIcon,
  ListChecksIcon,
  PaletteIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import {
  type FocusEvent,
  lazy,
  type MouseEvent,
  memo,
  type ReactNode,
  Suspense,
  useCallback,
} from "react";

import type { PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import type { createAccountApi } from "./account-api";
import type { AuditView as AuditComponent } from "./audit-view";
import type { DesignSystemView as DesignSystemComponent } from "./design-system-view";
import type { OrganizationView as OrganizationComponent } from "./organization-view";
import type { OverviewView as OverviewComponent } from "./overview-view";
import { PersonDirectory } from "./person-identity";
import type { SyncHistoryView as SyncHistoryComponent } from "./sync-history-view";
import type { TransactionsView as TransactionsComponent } from "./transactions-view";
import { WorkspacePageError } from "./workspace-page";
import { scopedHref } from "./workspace-resource";
import { SidebarFrame, WorkspaceFrame } from "./workspace-shell";
import { WorkspaceSkeleton } from "./workspace-ui";

const loadInvestments = async () => {
  const { data, error } = await tryCatch(() => import("./investments-view"));
  return { default: error ? WorkspacePageError : data.InvestmentsView };
};
const InvestmentsView = memo(lazy(loadInvestments));
const loadOverview = async () => {
  const { data, error } = await tryCatch(() => import("./overview-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.OverviewView };
};
const loadCards = async () => {
  const { data, error } = await tryCatch(() => import("./cards-view"));
  return { default: error ? WorkspacePageError : data.CardsView };
};
const CardsView = memo(lazy(loadCards));
const loadAudit = async () => {
  const { data, error } = await tryCatch(() => import("./audit-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.AuditView };
};
const loadDesignSystem = async () => {
  const { data, error } = await tryCatch(() => import("./design-system-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.DesignSystemView };
};
const loadOrganization = async () => {
  const { data, error } = await tryCatch(() => import("./organization-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.OrganizationView };
};
const loadSyncHistory = async () => {
  const { data, error } = await tryCatch(() => import("./sync-history-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.SyncHistoryView };
};
const loadTransactions = async () => {
  const { data, error } = await tryCatch(() => import("./transactions-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.TransactionsView };
};
const OverviewView = memo(lazy<typeof OverviewComponent>(loadOverview));
const AuditView = memo(lazy<typeof AuditComponent>(loadAudit));
const DesignSystemView = memo(
  lazy<typeof DesignSystemComponent>(loadDesignSystem),
);
const OrganizationView = memo(
  lazy<typeof OrganizationComponent>(loadOrganization),
);
const SyncHistoryView = memo(
  lazy<typeof SyncHistoryComponent>(loadSyncHistory),
);
const TransactionsView = memo(
  lazy<typeof TransactionsComponent>(loadTransactions),
);
const pageLoaders: Record<string, (() => Promise<unknown>) | undefined> = {
  "/account": loadOverview,
  "/account/audit": loadAudit,
  "/account/cards": loadCards,
  "/account/connections": () => import("./dashboard-view"),
  "/account/design-system": loadDesignSystem,
  "/account/groups": loadOrganization,
  "/account/investments": loadInvestments,
  "/account/rules": loadOrganization,
  "/account/sync": loadSyncHistory,
  "/account/transactions": loadTransactions,
};

function preloadPage(event: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  const href = event.currentTarget.getAttribute("href");
  if (!href) {
    return;
  }
  const path = new URL(href, location.href).pathname;
  const load = pageLoaders[path];
  if (load) {
    // Warm code on intent only; queries still belong to the mounted page.
    tryCatch(load).then(
      ({ data: _data, error: _error }) => undefined,
      () => undefined,
    );
  }
}
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
    icon: CreditCardIcon,
    name: "Cartões",
    path: "/account/cards",
  },
  { icon: BankIcon, name: "Investimentos", path: "/account/investments" },
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
  if (path === "/account/cards") {
    content = (
      <CardsView
        api={api}
        key={route}
        snapshot={snapshot}
      />
    );
  }
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
  if (path === "/account/investments") {
    content = (
      <InvestmentsView
        api={api}
        key={route}
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
    <PersonDirectory value={snapshot.people}>
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
        <div
          className="workspace-page"
          key={route}
        >
          <Suspense fallback={<WorkspaceSkeleton />}>{content}</Suspense>
        </div>
      </WorkspaceFrame>
    </PersonDirectory>
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
                onFocus={preloadPage}
                onMouseEnter={preloadPage}
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
            onFocus={preloadPage}
            onMouseEnter={preloadPage}
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
