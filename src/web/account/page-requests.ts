import type { PortalQuery, PortalResponse } from "../../contracts";
import {
  ChartType,
  SpendingGroupBy,
  TransactionDirection,
  TransactionOrder,
  TransactionStatus,
} from "../../domain";
import type { AccountBoot, createAccountApi } from "./account-api";
import { accountPath } from "./account-navigation";
import { monthPeriod, selectedMonth, shiftMonth } from "./dashboard-period";

// First requests of the pages people open most. The entry issues them while
// the panel's code downloads and the pages build the same queries, so each
// page adopts the response already in flight. Kept free of UI imports.

export function identityParameters(params: URLSearchParams) {
  const institutionId = params.get("institutionId");
  const cardBrand = params.get("cardBrand");
  return {
    ...(institutionId && { institutionId }),
    ...(cardBrand && { cardBrand }),
  };
}

export function referenceDay() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

export function overviewRequests(params: URLSearchParams, day: string) {
  const month = selectedMonth(params.get("month"), day);
  const period = monthPeriod(month);
  const spaceId = params.get("space") || "personal";
  const personId = params.get("person") ?? "";
  const scope = {
    spaceId,
    ...(personId && { personId }),
    ...identityParameters(params),
  };
  return {
    chart: {
      tool: "generate_chart",
      ...scope,
      from: `${shiftMonth(month, -11)}-01`,
      groupBy: SpendingGroupBy.month,
      to: period.to,
      type: ChartType.line,
    },
    month,
    overview: { tool: "get_overview", ...scope, ...period },
    recent: {
      tool: "get_portal_transactions",
      ...scope,
      ...period,
      future: false,
      limit: 6,
      order: TransactionOrder.date_desc,
    },
    spaceId,
  } satisfies Record<string, PortalQuery | string>;
}

const directions = Object.values(TransactionDirection);
const statuses = [TransactionStatus.PENDING, TransactionStatus.POSTED];

// The API validates the query; the page only keeps known filter values.
export function transactionRequests(params: URLSearchParams) {
  const spaceId = params.get("space") || "personal";
  const direction = directions.find(
    (value) => value === params.get("direction"),
  );
  const status = statuses.find((value) => value === params.get("status"));
  const person = params.get("person");
  const transactions: Extract<
    PortalQuery,
    { tool: "get_portal_transactions" }
  > = {
    ...identityParameters(params),
    future: params.get("future") === "on",
    limit: 50,
    order: TransactionOrder.date_desc,
    spaceId,
    tool: "get_portal_transactions",
    ...Object.fromEntries(
      ["cursor", "from", "to", "text", "accountId", "categoryId"].flatMap(
        (key) => {
          const value = params.get(key);
          return value ? [[key, value] as const] : [];
        },
      ),
    ),
    ...(direction && { direction }),
    ...(status && { status }),
    ...(person && { personId: person }),
    include_ignored: params.get("ignored") === "on",
    uncategorized: params.get("uncategorized") === "on",
    ...(params.get("cards") === "on" && { cardsOnly: true }),
  };
  return {
    accounts: {
      include_hidden: true,
      spaceId,
      tool: "get_accounts",
    } satisfies PortalQuery,
    spaceId,
    transactions,
  };
}

// Same condition the workspace uses to show the overview instead of setup.
export function hasImportedData(snapshot: PortalResponse) {
  return snapshot.connections.some(
    (connection) => connection.hasTransactions || connection.lastSuccessAt,
  );
}

// What the current page asks for first. The Worker answers these with the
// page; otherwise the entry sends them while the panel's code downloads.
export function pageRequests(
  path: string,
  params: URLSearchParams,
  snapshot: PortalResponse,
  day: string,
): { spaceId: string; queries: PortalQuery[] } | null {
  if (path === "/account" && hasImportedData(snapshot)) {
    const requests = overviewRequests(params, day);
    return {
      queries: [requests.overview, requests.chart, requests.recent],
      spaceId: requests.spaceId,
    };
  }
  if (path === "/account/transactions") {
    const requests = transactionRequests(params);
    return {
      queries: [requests.accounts, requests.transactions],
      spaceId: requests.spaceId,
    };
  }
  return null;
}

export function startPageRequests(
  api: ReturnType<typeof createAccountApi>,
  boot: AccountBoot | undefined,
) {
  // Without state, or with the answers already inline, there is nothing to send.
  if (!boot || boot.page) {
    return;
  }
  const requests = pageRequests(
    accountPath(location.pathname),
    new URLSearchParams(location.search),
    boot,
    referenceDay(),
  );
  if (!requests) {
    return;
  }
  api.prefetchCatalog(requests.spaceId);
  for (const query of requests.queries) {
    api.prefetch(query, boot.csrf);
  }
}
