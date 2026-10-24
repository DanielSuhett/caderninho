import { Sidebar, useSidebar } from "@cloudflare/kumo";
import {
  ArrowsClockwiseIcon,
  BankIcon,
  FoldersIcon,
  HouseIcon,
  ListChecksIcon,
  NotebookIcon,
  PaletteIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import {
  type KeyboardEvent,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
} from "react";

import type { PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import type { createAccountApi } from "./account-api";
import { WorkspacePageError } from "./workspace-page";
import { scopedHref } from "./workspace-resource";
import { WorkspaceSkeleton } from "./workspace-ui";

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

function RouteNavigation({ route }: { route: string }) {
  const { setOpenMobile } = useSidebar();
  const previousRoute = useRef(route);
  useEffect(() => {
    if (!route) {
      return;
    }
    const changed = previousRoute.current !== route;
    previousRoute.current = route;
    setOpenMobile(false);
    if (!changed) {
      return;
    }
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("workspace-content")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [route, setOpenMobile]);
  return null;
}

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
    <Sidebar.Provider
      className="workspace"
      mobileBreakpoint={760}
    >
      <RouteNavigation route={route} />
      <WorkspaceNavigation
        busy={busy}
        logout={logout}
        snapshot={snapshot}
      />
      <WorkspaceContent>
        <Suspense
          fallback={<WorkspaceSkeleton />}
          key={route}
        >
          {content}
        </Suspense>
      </WorkspaceContent>
    </Sidebar.Provider>
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
  const { state, isMobile, openMobile } = useSidebar();
  const restoreMenuTrigger = useCallback(() => {
    requestAnimationFrame(() =>
      document.getElementById("workspace-menu-trigger")?.focus(),
    );
  }, []);
  const containMobileTab = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Tab" || !isMobile || !openMobile) {
        return;
      }
      const controls = [
        ...event.currentTarget.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),[tabindex='0']",
        ),
      ].filter(
        (node) => !node.closest("[inert]") && node.getClientRects().length > 0,
      );
      const [first] = controls;
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    },
    [isMobile, openMobile],
  );
  const showLabels = state !== "collapsed" || isMobile;
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  return (
    <Sidebar
      aria-label="Navegação do Caderninho"
      id="workspace-navigation"
      onKeyDown={containMobileTab}
      {...(isMobile && { "aria-modal": openMobile, role: "dialog" })}
    >
      <Sidebar.Header>
        <a
          aria-label="Caderninho, visão geral"
          className="workspace-brand"
          href="/account"
        >
          <NotebookIcon
            aria-hidden
            size={20}
          />
          {showLabels === true && <span>Caderninho</span>}
        </a>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Instalação pessoal</Sidebar.GroupLabel>
          <nav aria-label="Páginas do Caderninho">
            <Sidebar.Menu>
              {pages.map((page) => (
                <Sidebar.MenuButton
                  active={path === page.path}
                  aria-current={path === page.path ? "page" : undefined}
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
              href="/account/design-system"
              icon={PaletteIcon}
              tooltip="Referência visual"
            >
              Referência visual
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              disabled={busy}
              icon={SignOutIcon}
              onClick={logout}
              tooltip="Sair"
            >
              Sair
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        {isMobile ? (
          <Sidebar.Close
            aria-label="Fechar navegação"
            onClick={restoreMenuTrigger}
          />
        ) : (
          <Sidebar.Trigger aria-label="Alternar navegação" />
        )}
        {showLabels === true && (
          <p className="sidebar-installation">
            {snapshot.people.length}{" "}
            {snapshot.people.length === 1 ? "pessoa" : "pessoas"} ·{" "}
            {snapshot.connections.length}{" "}
            {snapshot.connections.length === 1 ? "conexão" : "conexões"}
          </p>
        )}
      </Sidebar.Footer>
    </Sidebar>
  );
}

function WorkspaceContent({ children }: { children: ReactNode }) {
  const { isMobile, openMobile } = useSidebar();
  return (
    <div
      className="workspace-main"
      inert={isMobile && openMobile}
    >
      <a
        className="skip-link"
        href="#workspace-content"
      >
        Ir para o conteúdo
      </a>
      <header className="workspace-mobile-header">
        <Sidebar.Trigger
          aria-controls="workspace-navigation"
          aria-expanded={openMobile}
          aria-label="Abrir navegação"
          id="workspace-menu-trigger"
        />
        <span>Caderninho</span>
      </header>
      <main
        className="workspace-content"
        id="workspace-content"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="workspace-footer">
        Seus dados na sua Cloudflare. Acesso controlado por você.
      </footer>
    </div>
  );
}
