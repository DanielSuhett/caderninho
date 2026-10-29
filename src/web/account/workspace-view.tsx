import { Badge } from "@cloudflare/kumo/components/badge";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  ArrowCounterClockwiseIcon,
  BankIcon,
  ChartLineIcon,
  CreditCardIcon,
  HouseIcon,
  LifebuoyIcon,
  ListChecksIcon,
  ReceiptIcon,
  SignOutIcon,
  TagIcon,
} from "@phosphor-icons/react";
import {
  type FocusEvent,
  lazy,
  type MouseEvent,
  memo,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
} from "react";

import type { PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import { UiIconButton, UiLink } from "../ui";
import type { createAccountApi } from "./account-api";
import { accountPath } from "./account-navigation";
import type { AuditView as AuditComponent } from "./audit-view";
import { warmWhenIdle } from "./deferred";
import type { OrganizationView as OrganizationComponent } from "./organization-view";
import type { OverviewView as OverviewComponent } from "./overview-view";
import { PersonDirectory } from "./person-identity";
import { pageLoaders, warmPage } from "./route-preload";
import { focusPageSearch, isSearchShortcut } from "./search-shortcut";
import { TransactionReaderProvider } from "./transaction-reader";
import type { TransactionsView as TransactionsComponent } from "./transactions-view";
import { WorkspacePageError } from "./workspace-page";
import { ResourceVersion, scopedHref } from "./workspace-resource";
import { SidebarFrame, WorkspaceFrame } from "./workspace-shell";

const loadInvestments = async () => {
  const { data, error } = await tryCatch(() => import("./investments-view"));
  return { default: error ? WorkspacePageError : data.InvestmentsView };
};
const InvestmentsView = memo(lazy(loadInvestments));
const loadReserve = async () => {
  const { data, error } = await tryCatch(() => import("./reserve-view"));
  return { default: error ? WorkspacePageError : data.ReserveView };
};
const ReserveView = memo(lazy(loadReserve));
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
const loadOrganization = async () => {
  const { data, error } = await tryCatch(() => import("./organization-view"));
  if (error) {
    return { default: WorkspacePageError };
  }
  return { default: data.OrganizationView };
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
const OrganizationView = memo(
  lazy<typeof OrganizationComponent>(loadOrganization),
);
const TransactionsView = memo(
  lazy<typeof TransactionsComponent>(loadTransactions),
);
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
    icon: TagIcon,
    name: "Categorias",
    path: "/account/categories",
  },
  { icon: LifebuoyIcon, name: "Reserva", path: "/account/reserve" },
  {
    icon: BankIcon,
    name: "Conexões",
    path: "/account/connections",
  },
  { icon: ChartLineIcon, name: "Observabilidade", path: "/account/audit" },
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
  useEffect(() => warmWhenIdle(pageLoaders), []);
  useEffect(() => {
    const listen = (event: KeyboardEvent) => {
      if (isSearchShortcut(event) && focusPageSearch()) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);
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
  if (path === "/account/rules" || path === "/account/categories") {
    content = (
      <OrganizationView
        api={api}
        key={route}
        page={path.endsWith("rules") ? "rules" : "categories"}
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
  if (path === "/account/reserve") {
    content = (
      <ReserveView
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
              <Suspense fallback={null}>{content}</Suspense>
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
    <SidebarFrame
      brandHref={scopedHref("/account", params)}
      {...(demo && {
        tools: (
          <>
            <Tooltip
              content="Instalar minha cópia"
              render={
                <UiLink
                  aria-label="Instalar minha cópia"
                  href="/#install-title"
                  shape="square"
                  variant="ghost"
                >
                  <HouseIcon
                    aria-hidden
                    size={20}
                  />
                </UiLink>
              }
            />
            <UiIconButton
              label="Restaurar demonstração"
              onClick={reset}
              variant="ghost"
            >
              <ArrowCounterClockwiseIcon
                aria-hidden
                size={20}
              />
            </UiIconButton>
          </>
        ),
      })}
    >
      <nav aria-label="Páginas do Caderninho">
        {[
          {
            name: "Finanças",
            paths: [
              "/account",
              "/account/transactions",
              "/account/cards",
              "/account/investments",
              "/account/reserve",
            ],
          },
          {
            name: "Organização",
            paths: ["/account/categories", "/account/rules"],
          },
          {
            name: "Instalação",
            paths: ["/account/connections", "/account/audit"],
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
