import { Badge } from "@cloudflare/kumo/components/badge";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
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
import { accountPath, workspaceHref } from "./account-navigation";
import type { AuditView as AuditComponent } from "./audit-view";
import type { DesignSystemView as DesignSystemComponent } from "./design-system-view";
import type { OrganizationView as OrganizationComponent } from "./organization-view";
import type { OverviewView as OverviewComponent } from "./overview-view";
import { PersonDirectory } from "./person-identity";
import type { SyncHistoryView as SyncHistoryComponent } from "./sync-history-view";
import { TransactionReaderProvider } from "./transaction-reader";
import type { TransactionsView as TransactionsComponent } from "./transactions-view";
import { WorkspacePageError } from "./workspace-page";
import { ResourceVersion, scopedHref } from "./workspace-resource";
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

// Warm code only; queries still belong to the mounted page.
function warmPage(pathname: string) {
  const load = pageLoaders[accountPath(pathname)];
  if (load) {
    tryCatch(load).then(
      ({ data: _data, error: _error }) => undefined,
      () => undefined,
    );
  }
}

// The current page's code downloads while the installation is being read.
export function preloadCurrentPage() {
  warmPage(location.pathname);
}

function preloadPage(event: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  const href = event.currentTarget.getAttribute("href");
  if (href) {
    warmPage(new URL(href, location.href).pathname);
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
    name: "Pessoas",
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
  dataVersion,
  readError,
  demo = false,
}: {
  route: string;
  dataVersion: number;
  readError: boolean;
  children: ReactNode;
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
  command: (action: string) => void;
  busy: boolean;
  demo?: boolean;
}) {
  const path = accountPath(location.pathname);
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
    <ResourceVersion value={dataVersion}>
      <PersonDirectory value={snapshot.people}>
        <TransactionReaderProvider
          api={api}
          csrf={snapshot.csrf}
          spaceId={
            new URLSearchParams(location.search).get("space") ?? "personal"
          }
        >
          <WorkspaceFrame
            brandHref={scopedHref(
              "/account",
              new URLSearchParams(location.search),
            )}
            demo={demo}
            failed={snapshot.connections.some(
              (connection) => connection.importStatus === "failed",
            )}
            navigation={
              <WorkspaceNavigation
                busy={busy}
                demo={demo}
                logout={logout}
              />
            }
            route={route}
            syncing={snapshot.connections.some(
              (connection) =>
                connection.importStatus === "pending" ||
                connection.importStatus === "running",
            )}
            unavailable={readError}
            updatedAt={
              snapshot.connections
                .map((connection) => connection.lastSuccessAt)
                .filter((value): value is string => !!value)
                .sort()
                .at(-1) ?? null
            }
          >
            <div
              className="workspace-page"
              key={route}
            >
              {!!demo && (
                <div className="demo-toolbar">
                  <Tooltip
                    content="Dados fictícios. As alterações duram até recarregar a aba."
                    render={
                      <button type="button">
                        <Badge variant="secondary">Demo</Badge>
                      </button>
                    }
                  />
                </div>
              )}
              <Suspense fallback={<WorkspaceSkeleton />}>{content}</Suspense>
            </div>
          </WorkspaceFrame>
        </TransactionReaderProvider>
      </PersonDirectory>
    </ResourceVersion>
  );
}

function WorkspaceNavigation({
  busy,
  logout,
  demo,
}: {
  busy: boolean;
  logout: () => void;
  demo: boolean;
}) {
  const path = accountPath(location.pathname);
  const params = new URLSearchParams(location.search);
  const reset = useCallback(() => location.reload(), []);
  return (
    <SidebarFrame brandHref={scopedHref("/account", params)}>
      <nav aria-label="Páginas do Caderninho">
        {[
          {
            name: "Finanças",
            paths: [
              "/account",
              "/account/transactions",
              "/account/cards",
              "/account/investments",
            ],
          },
          { name: "Organização", paths: ["/account/rules", "/account/groups"] },
          {
            name: "Instalação",
            paths: ["/account/connections", "/account/sync", "/account/audit"],
          },
        ].map((group) => (
          <Sidebar.Group key={group.name}>
            <Sidebar.GroupLabel>{group.name}</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {group.paths
                .map((target) => pages.find((page) => page.path === target))
                .filter((page) => page !== undefined)
                .map((page) => (
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
          </Sidebar.Group>
        ))}
      </nav>
      <Sidebar.Group>
        <Sidebar.Menu>
          <Sidebar.MenuButton
            active={path === "/account/design-system"}
            className="text-base"
            href={workspaceHref("/account/design-system")}
            icon={PaletteIcon}
            onFocus={preloadPage}
            onMouseEnter={preloadPage}
            tooltip="Referência visual"
          >
            Referência visual
          </Sidebar.MenuButton>
          {demo ? (
            <>
              <Sidebar.MenuButton href="/#install-title">
                Instalar minha cópia
              </Sidebar.MenuButton>
              <Sidebar.MenuButton onClick={reset}>
                Restaurar demonstração
              </Sidebar.MenuButton>
            </>
          ) : null}
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
