import { Badge } from "@cloudflare/kumo/components/badge";
import { Select } from "@cloudflare/kumo/components/select";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Toasty } from "@cloudflare/kumo/components/toast";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { KumoLocaleProvider } from "@cloudflare/kumo/utils";
import {
  ArrowSquareOutIcon,
  ChartPieSliceIcon,
  CreditCardIcon,
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
import { demoPortalFixture } from "../fixtures/workspace";
import { tryCatch } from "../shared";
import {
  navigateWorkspace,
  useWorkspaceNavigation,
} from "./account/account-navigation";
import { monthLabel } from "./account/dashboard-period";
import { FinancialDashboard } from "./account/financial-dashboard";
import { PeriodPicker } from "./account/period-picker";
import { PersonDirectory, PersonStack } from "./account/person-identity";
import { ScopeFields } from "./account/workspace-filters";
import { WorkspacePageError } from "./account/workspace-page";
import { SidebarFrame, WorkspaceFrame } from "./account/workspace-shell";
import {
  WorkspaceFilters,
  WorkspaceHeading,
  WorkspaceSkeleton,
} from "./account/workspace-ui";
import {
  demoMonthly,
  demoOverview,
  demoTransactions,
  selectedDemoMonth,
} from "./demo-data";
import { createDemoSession } from "./demo-session";
import { DemoTransactions } from "./demo-transactions";
import { UiLink } from "./ui";
import "./account.css";

const Organization = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./demo-organization"));
  return { default: error ? WorkspacePageError : data.DemoOrganization };
});
const Cards = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./account/cards-view"));
  return { default: error ? WorkspacePageError : data.CardsView };
});
const Investments = lazy(async () => {
  const { data, error } = await tryCatch(
    () => import("./account/investments-view"),
  );
  return { default: error ? WorkspacePageError : data.InvestmentsView };
});
const demoSnapshot = demoPortalFixture();
const trailingSlash = /\/$/;
const pages = [
  { icon: HouseIcon, label: "Visão geral", path: "" },
  { icon: ReceiptIcon, label: "Transações", path: "/transactions" },
  { icon: CreditCardIcon, label: "Cartões", path: "/cards" },
  { icon: ChartPieSliceIcon, label: "Investimentos", path: "/investments" },
  { icon: ListChecksIcon, label: "Regras", path: "/rules" },
  { icon: FolderIcon, label: "Grupos", path: "/groups" },
];
function DemoNavigation({
  session,
  onReset,
}: {
  onReset: () => void;
  session: ReturnType<typeof createDemoSession>;
}) {
  const params = new URLSearchParams(location.search);
  const group = session
    .spaces()
    .find((space) => space.id === (params.get("space") ?? "personal"));
  const scope = new URLSearchParams({
    currency: params.get("currency") ?? group?.currency ?? "BRL",
    month: selectedDemoMonth(params.get("month")),
    ...(params.get("person") && { person: params.get("person") ?? "" }),
    ...(params.get("space") && { space: params.get("space") ?? "" }),
  });
  return (
    <SidebarFrame
      brandHref={`/demo?${scope}`}
      footer=""
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
          <Sidebar.MenuButton onClick={onReset}>
            Restaurar demonstração
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
  const allData = session.view(spaceId);
  const personId = params.get("person") ?? "";
  const data = {
    ...allData,
    accounts: allData.accounts.filter(
      (account) => !personId || account.personId === personId,
    ),
    records: allData.records.filter(
      (row) => !personId || row.personId === personId,
    ),
  };
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
  const scope = new URLSearchParams({
    month,
    space: spaceId,
    ...(personId && { person: personId }),
  });
  return (
    <>
      <WorkspaceHeading
        title={transactions ? "Transações" : "Visão geral"}
        {...(transactions && { description: monthLabel(month) })}
      >
        <div className="page-actions">
          {!transactions && (
            <PeriodPicker
              fromMonth="2026-05"
              month={month}
              onChange={changeMonth}
              toMonth="2026-10"
            />
          )}
        </div>
      </WorkspaceHeading>
      {transactions ? (
        <DemoTransactions
          data={data}
          key={route}
          month={month}
          params={params}
          spaces={spaces}
        />
      ) : (
        <>
          <WorkspaceFilters
            action="/demo"
            activeCount={Number(!!personId) + Number(spaceId !== "personal")}
            identity={
              <PersonStack
                people={demoPeople}
                personId={personId}
              />
            }
            showClear={!!personId || spaceId !== "personal"}
          >
            <ScopeFields
              catalog={{ spaces }}
              compact
              params={params}
              snapshot={demoSnapshot}
            />
            <Select
              className="w-full"
              defaultValue={currency}
              items={currencies.map((value) => ({ label: value, value }))}
              label="Moeda"
              name="currency"
            />
            <input
              name="month"
              type="hidden"
              value={month}
            />
          </WorkspaceFilters>
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
            showOwner={!personId}
            transactionsHref={`/demo/transactions?${scope}`}
          />
        </>
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
  const cards = location.pathname.includes("/cards");
  const investments = location.pathname.includes("/investments");
  const params = new URLSearchParams(location.search);
  const unavailable = !session
    .spaces()
    .some((space) => space.id === (params.get("space") ?? "personal"));
  return (
    <KumoLocaleProvider
      translations={{ layerDialog: { cancel: "Cancelar", close: "Fechar" } }}
    >
      <PersonDirectory value={demoPeople}>
        <TooltipProvider>
          <Toasty>
            <WorkspaceFrame
              footer=""
              navigation={
                <DemoNavigation
                  onReset={reset}
                  session={session}
                />
              }
              route={route}
            >
              <div className="workspace-page">
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
                        location.pathname.includes("/rules")
                          ? "rules"
                          : "groups"
                      }
                      session={session}
                    />
                  </Suspense>
                )}
                {!unavailable && cards && (
                  <Suspense fallback={<WorkspaceSkeleton />}>
                    <Cards
                      api={session.api}
                      basePath="/demo/cards"
                      key={route}
                      snapshot={demoSnapshot}
                    />
                  </Suspense>
                )}
                {!unavailable && investments && (
                  <Suspense fallback={<WorkspaceSkeleton />}>
                    <Investments
                      api={session.api}
                      basePath="/demo/investments"
                      key={route}
                      snapshot={demoSnapshot}
                    />
                  </Suspense>
                )}
                {!(unavailable || organization || cards || investments) && (
                  <DemoFinancial
                    route={route}
                    session={session}
                  />
                )}
              </div>
            </WorkspaceFrame>
          </Toasty>
        </TooltipProvider>
      </PersonDirectory>
    </KumoLocaleProvider>
  );
}
const root = document.getElementById("demo-root");
if (root) {
  createRoot(root).render(<Demo />);
}
