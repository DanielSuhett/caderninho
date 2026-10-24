import {
  KumoLocaleProvider,
  Select,
  Sidebar,
  Toasty,
  TooltipProvider,
} from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  FolderIcon,
  HouseIcon,
  ListChecksIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import {
  lazy,
  Suspense,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";

import { demoPeople, demoReferenceDay } from "../fixtures/finance";
import { tryCatch } from "../shared";
import {
  navigateWorkspace,
  useWorkspaceNavigation,
} from "./account/account-navigation";
import { monthLabel } from "./account/dashboard-period";
import { FinancialDashboard } from "./account/financial-dashboard";
import { PeriodPicker } from "./account/period-picker";
import { WorkspacePageError } from "./account/workspace-page";
import { SidebarFrame, WorkspaceFrame } from "./account/workspace-shell";
import { WorkspaceHeading, WorkspaceSkeleton } from "./account/workspace-ui";
import {
  demoMonthly,
  demoOverview,
  demoTransactions,
  selectedDemoMonth,
} from "./demo-data";
import { createDemoSession } from "./demo-session";
import { DemoTransactions } from "./demo-transactions";
import { UiButton, UiLink } from "./ui";
import "./account.css";

const Organization = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./demo-organization"));
  return { default: error ? WorkspacePageError : data.DemoOrganization };
});
const trailingSlash = /\/$/;
const pages = [
  { icon: HouseIcon, label: "Visão geral", path: "" },
  { icon: ReceiptIcon, label: "Transações", path: "/transactions" },
  { icon: ListChecksIcon, label: "Regras", path: "/rules" },
  { icon: FolderIcon, label: "Grupos", path: "/groups" },
];
function DemoNavigation({
  session,
}: {
  session: ReturnType<typeof createDemoSession>;
}) {
  const params = new URLSearchParams(location.search);
  const group = session
    .spaces()
    .find((space) => space.id === (params.get("space") ?? "personal"));
  const scope = new URLSearchParams({
    currency: params.get("currency") ?? group?.currency ?? "BRL",
    month: selectedDemoMonth(params.get("month")),
    ...(params.get("space") && { space: params.get("space") ?? "" }),
  });
  return (
    <SidebarFrame
      brandHref={`/demo?${scope}`}
      footer="Demonstração · dados fictícios"
    >
      <Sidebar.Group>
        <Sidebar.GroupLabel>Explore o Caderninho</Sidebar.GroupLabel>
        <nav aria-label="Páginas da demonstração">
          <Sidebar.Menu>
            {pages.map((page) => (
              <Sidebar.MenuButton
                active={
                  location.pathname.replace(trailingSlash, "") ===
                  `/demo${page.path}`
                }
                className="text-base"
                href={`/demo${page.path}?${scope}`}
                icon={page.icon}
                key={page.path}
              >
                {page.label}
              </Sidebar.MenuButton>
            ))}
          </Sidebar.Menu>
        </nav>
      </Sidebar.Group>
      <Sidebar.Group>
        <Sidebar.Menu>
          <Sidebar.MenuButton
            className="text-base"
            href="/#install-title"
            icon={ArrowSquareOutIcon}
          >
            Instalar minha cópia
          </Sidebar.MenuButton>
          <Sidebar.MenuButton
            className="text-base"
            href="/"
            icon={ArrowSquareOutIcon}
          >
            Voltar ao site
          </Sidebar.MenuButton>
        </Sidebar.Menu>
      </Sidebar.Group>
    </SidebarFrame>
  );
}
function DemoFinancial({
  session,
  route,
}: {
  session: ReturnType<typeof createDemoSession>;
  route: string;
}) {
  const params = new URLSearchParams(location.search);
  const month = selectedDemoMonth(params.get("month"));
  const spaceId = params.get("space") ?? "personal";
  const data = session.view(spaceId);
  const spaces = session.spaces();
  const currencies = [
    ...new Set(["BRL", "USD", ...spaces.map((space) => space.currency)]),
  ];
  const requestedCurrency = params.get("currency") ?? "";
  const currency = currencies.includes(requestedCurrency)
    ? requestedCurrency
    : (spaces.find((space) => space.id === spaceId)?.currency ?? "BRL");
  const transactions = location.pathname.includes("/transactions");
  const records = demoTransactions({ currency, data, month });
  const changeMonth = useCallback((value: string) => {
    const url = new URL(location.href);
    url.searchParams.set("month", value);
    navigateWorkspace(url);
  }, []);
  const changeCurrency = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("currency", value);
    url.searchParams.delete("accountId");
    navigateWorkspace(url);
  }, []);
  const changeSpace = useCallback(
    (value: string | null) => {
      if (!value) {
        return;
      }
      const url = new URL(location.href);
      url.searchParams.set("space", value);
      const selected = session.spaces().find((space) => space.id === value);
      if (selected) {
        url.searchParams.set("currency", selected.currency);
      }
      for (const key of ["accountId", "text", "direction"]) {
        url.searchParams.delete(key);
      }
      navigateWorkspace(url);
    },
    [session],
  );
  const scope = new URLSearchParams({ month, space: spaceId });
  return (
    <>
      <WorkspaceHeading
        title={transactions ? "Transações" : "Visão geral"}
        {...(transactions && { description: monthLabel(month) })}
      >
        <div className="page-actions">
          {(spaces.length > 1 || spaceId !== "personal") && (
            <Select
              items={spaces.map((space) => ({
                label: space.name,
                value: space.id,
              }))}
              label="Grupo"
              onValueChange={changeSpace}
              value={spaceId}
            />
          )}
          {!transactions && (
            <>
              <PeriodPicker
                fromMonth="2026-05"
                month={month}
                onChange={changeMonth}
                toMonth="2026-10"
              />
              <Select
                items={currencies.map((value) => ({ label: value, value }))}
                label="Moeda"
                onValueChange={changeCurrency}
                value={currency}
              />
            </>
          )}
        </div>
      </WorkspaceHeading>
      {transactions ? (
        <DemoTransactions
          data={data}
          key={route}
          month={month}
          params={params}
        />
      ) : (
        <FinancialDashboard
          categories={data.categories}
          currency={currency}
          monthly={demoMonthly(month, data)}
          overview={demoOverview(month, data)}
          people={demoPeople}
          recentScope={`${currency} · últimos registros do mês`}
          records={records
            .filter((row) => row.date <= demoReferenceDay)
            .slice(0, 6)}
          rulesHref={`/demo/rules?${scope}`}
          transactionsHref={`/demo/transactions?${scope}`}
        />
      )}
    </>
  );
}
function Demo() {
  const route = useWorkspaceNavigation();
  const [session] = useState(createDemoSession);
  useSyncExternalStore(session.subscribe, session.revision, session.revision);
  const [resetVersion, setResetVersion] = useState(0);
  const reset = useCallback(() => {
    session.reset();
    setResetVersion((value) => value + 1);
    navigateWorkspace(new URL("/demo?month=2026-10", location.origin));
  }, [session]);
  const organization =
    location.pathname.includes("/rules") ||
    location.pathname.includes("/groups");
  const params = new URLSearchParams(location.search);
  const unavailable = !session
    .spaces()
    .some((space) => space.id === (params.get("space") ?? "personal"));
  return (
    <KumoLocaleProvider
      translations={{ layerDialog: { cancel: "Cancelar", close: "Fechar" } }}
    >
      <TooltipProvider>
        <Toasty>
          <WorkspaceFrame
            footer="Demonstração pública. Nenhuma conta real ou conexão bancária é utilizada."
            navigation={<DemoNavigation session={session} />}
            route={route}
          >
            <div className="workspace-page">
              <div className="demo-toolbar">
                <p className="demo-notice">
                  Dados fictícios · alterações até recarregar esta aba
                </p>
                <UiButton
                  onClick={reset}
                  type="button"
                  variant="ghost"
                >
                  Restaurar demo
                </UiButton>
              </div>
              {unavailable && (
                <>
                  <WorkspaceHeading title="Grupo indisponível nesta sessão" />
                  <p>
                    Ao recarregar a aba, os grupos criados na demo são
                    removidos. Os dados iniciais continuam disponíveis.
                  </p>
                  <UiLink
                    href={`/demo?month=${selectedDemoMonth(params.get("month"))}`}
                  >
                    Abrir grupo Pessoal
                  </UiLink>
                </>
              )}
              {!unavailable && organization && (
                <Suspense fallback={<WorkspaceSkeleton />}>
                  <Organization
                    key={`${route}:${resetVersion}`}
                    page={
                      location.pathname.includes("/rules") ? "rules" : "groups"
                    }
                    session={session}
                  />
                </Suspense>
              )}
              {!(unavailable || organization) && (
                <DemoFinancial
                  route={route}
                  session={session}
                />
              )}
            </div>
          </WorkspaceFrame>
        </Toasty>
      </TooltipProvider>
    </KumoLocaleProvider>
  );
}
const root = document.getElementById("demo-root");
if (root) {
  createRoot(root).render(<Demo />);
}
