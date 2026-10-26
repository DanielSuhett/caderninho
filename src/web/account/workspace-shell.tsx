import { Sidebar, useSidebar } from "@cloudflare/kumo/components/sidebar";
import { NotebookIcon } from "@phosphor-icons/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { ThemeToggle } from "../theme-toggle";
import { AvatarFilterRoute } from "./identity-filters";
import {
  SyncStatusContext,
  SyncStatusIndicator,
} from "./sync-status-indicator";

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

export function WorkspaceFrame({
  route,
  navigation,
  children,
  footer,
  brandHref,
  updatedAt,
  syncing = false,
  failed = false,
  unavailable = false,
  demo = false,
}: {
  route: string;
  navigation: ReactNode;
  children: ReactNode;
  footer?: string;
  brandHref: string;
  updatedAt?: string | null;
  syncing?: boolean;
  failed?: boolean;
  unavailable?: boolean;
  demo?: boolean;
}) {
  return (
    <SyncStatusContext
      value={{ demo, failed, syncing, unavailable, updatedAt }}
    >
      <Sidebar.Provider
        className="workspace"
        mobileBreakpoint={760}
      >
        <RouteNavigation route={route} />
        {navigation}
        <WorkspaceContent
          brandHref={brandHref}
          {...(footer && { footer })}
        >
          <AvatarFilterRoute value={route}>{children}</AvatarFilterRoute>
        </WorkspaceContent>
      </Sidebar.Provider>
    </SyncStatusContext>
  );
}
export function SidebarFrame({
  brandHref,
  children,
}: {
  brandHref: string;
  children: ReactNode;
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
  return (
    <Sidebar
      aria-label="Navegação do Caderninho"
      id="workspace-navigation"
      onKeyDown={containMobileTab}
      {...(isMobile && { "aria-modal": openMobile, role: "dialog" })}
    >
      <Sidebar.Header className="workspace-sidebar-header">
        {showLabels === true && (
          <a
            aria-label="Caderninho, visão geral"
            className="workspace-brand"
            href={brandHref}
          >
            <NotebookIcon
              aria-hidden
              size={20}
            />
            {showLabels === true && <span>Caderninho</span>}
          </a>
        )}
        {isMobile ? (
          <Sidebar.Close
            aria-label="Fechar navegação"
            onClick={restoreMenuTrigger}
          />
        ) : (
          <Sidebar.Trigger aria-label="Alternar navegação" />
        )}
      </Sidebar.Header>
      <Sidebar.Content>{children}</Sidebar.Content>
      <Sidebar.Footer className="workspace-sidebar-footer">
        {!isMobile && (
          <>
            <SyncStatusIndicator />
            <ThemeToggle />
          </>
        )}
      </Sidebar.Footer>
    </Sidebar>
  );
}
function WorkspaceContent({
  children,
  footer = "",
  brandHref,
}: {
  children: ReactNode;
  footer?: string;
  brandHref: string;
}) {
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
      {isMobile === true && (
        <header className="workspace-mobile-header">
          <Sidebar.Trigger
            aria-controls="workspace-navigation"
            aria-expanded={openMobile}
            aria-label="Abrir navegação"
            id="workspace-menu-trigger"
          />
          <a
            className="workspace-brand"
            href={brandHref}
          >
            Caderninho
          </a>
          <div className="workspace-header-actions">
            <SyncStatusIndicator />
            <ThemeToggle />
          </div>
        </header>
      )}
      <main
        className="workspace-content"
        data-layout-grid={
          new URLSearchParams(location.search).get("grid") === "1" || undefined
        }
        id="workspace-content"
        tabIndex={-1}
      >
        {children}
      </main>
      {!!footer && <footer className="workspace-footer">{footer}</footer>}
    </div>
  );
}
