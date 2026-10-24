import {
  KumoLocaleProvider,
  Select,
  Sidebar,
  TooltipProvider,
} from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  HouseIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";

import { monthLabel } from "./account/dashboard-period";
import { FinancialDashboard } from "./account/financial-dashboard";
import { PeriodPicker } from "./account/period-picker";
import { SidebarFrame, WorkspaceFrame } from "./account/workspace-shell";
import { WorkspaceHeading } from "./account/workspace-ui";
import {
  demoCategories,
  demoMonthly,
  demoOverview,
  demoPeople,
  demoReferenceDay,
  demoTransactions,
  selectedDemoMonth,
} from "./demo-data";
import { DemoTransactions } from "./demo-transactions";

import "./account.css";

function DemoNavigation() {
  const params = new URLSearchParams(location.search);
  const scope = new URLSearchParams({
    currency: params.get("currency") === "USD" ? "USD" : "BRL",
    month: selectedDemoMonth(params.get("month")),
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
            <Sidebar.MenuButton
              active={
                location.pathname === "/demo" || location.pathname === "/demo/"
              }
              className="text-base"
              href={`/demo?${scope}`}
              icon={HouseIcon}
            >
              Visão geral
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              active={location.pathname.startsWith("/demo/transactions")}
              className="text-base"
              href={`/demo/transactions?month=${scope.get("month")}`}
              icon={ReceiptIcon}
            >
              Transações
            </Sidebar.MenuButton>
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
function Demo() {
  const [params] = useState(() => new URLSearchParams(location.search));
  const month = selectedDemoMonth(params.get("month"));
  const currency = params.get("currency") === "USD" ? "USD" : "BRL";
  const transactions = location.pathname.startsWith("/demo/transactions");
  const records = demoTransactions({ currency, month });
  const changeMonth = useCallback((value: string) => {
    const url = new URL(location.href);
    url.searchParams.set("month", value);
    location.assign(url);
  }, []);
  const changeCurrency = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("currency", value);
    url.searchParams.delete("accountId");
    location.assign(url);
  }, []);
  const transactionsHref = `/demo/transactions?${new URLSearchParams({ month })}`;
  return (
    <KumoLocaleProvider
      translations={{ layerDialog: { cancel: "Cancelar", close: "Fechar" } }}
    >
      <TooltipProvider>
        <WorkspaceFrame
          footer="Demonstração pública. Nenhuma conta real ou conexão bancária é utilizada."
          navigation={<DemoNavigation />}
          route={location.pathname + location.search}
        >
          <p className="demo-notice">Demonstração · dados fictícios</p>
          <WorkspaceHeading
            {...(transactions && { description: monthLabel(month) })}
            title={transactions ? "Transações" : "Visão geral"}
          >
            {!transactions && (
              <div className="page-actions">
                <PeriodPicker
                  fromMonth="2026-05"
                  month={month}
                  onChange={changeMonth}
                  toMonth="2026-10"
                />
                <Select
                  items={[
                    { label: "BRL", value: "BRL" },
                    { label: "USD", value: "USD" },
                  ]}
                  label="Moeda"
                  onValueChange={changeCurrency}
                  value={currency}
                />
              </div>
            )}
          </WorkspaceHeading>
          {transactions ? (
            <DemoTransactions
              month={month}
              params={params}
            />
          ) : (
            <FinancialDashboard
              categories={demoCategories}
              currency={currency}
              monthly={demoMonthly(month)}
              overview={demoOverview(month)}
              people={demoPeople}
              recentScope={`${currency} · últimos registros do mês`}
              records={records
                .filter((row) => row.date <= demoReferenceDay)
                .slice(0, 6)}
              transactionsHref={transactionsHref}
            />
          )}
        </WorkspaceFrame>
      </TooltipProvider>
    </KumoLocaleProvider>
  );
}
const root = document.getElementById("demo-root");
if (root) {
  createRoot(root).render(<Demo />);
}
