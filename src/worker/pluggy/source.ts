import type { PluggyClient } from "pluggy-sdk";
import { z } from "zod/v4";

import { FaultCode, type Resource } from "#domain/enums.ts";
import { Fault } from "#domain/fault.ts";
import { DEFINITIONS } from "#domain/finance-model.ts";
import type { Credentials } from "#domain/pluggy-credentials.ts";
import { ProviderRecordSchema } from "#domain/schemas.ts";
import { tryCatch } from "#shared/result.ts";
import type { ConnectionSource } from "#worker/account/service.ts";
import { PersonalPluggyClient } from "#worker/pluggy/client.adapter.ts";
import type {
  FinancialSource,
  Steps,
  StepValue,
} from "#worker/sync/service.ts";

export function pluggyClient(
  credentials: Credentials,
  maxResponseBytes = 4000000,
) {
  return new PersonalPluggyClient(credentials, maxResponseBytes);
}

// Translate only transport metadata into public faults. Upstream bodies, URLs and credentials
// stay inside the SDK error and never become a Fault cause, message, detail or log.
async function sdkResult<T>(operation: Promise<T>): Promise<T> {
  const result = await tryCatch(operation);
  if (!result.error) {
    return result.data;
  }
  const error = z
    .object({
      code: z.string().optional(),
      response: z
        .object({
          statusCode: z.number(),
          headers: z.object({
            "retry-after": z
              .union([z.string(), z.array(z.string())])
              .optional(),
          }),
        })
        .optional(),
    })
    .parse(result.error);
  const status = error.response?.statusCode;
  const codes: Record<number, FaultCode> = {
    401: FaultCode.UPSTREAM_AUTH,
    403: FaultCode.UPSTREAM_FORBIDDEN,
    404: FaultCode.UPSTREAM_NOT_FOUND,
    429: FaultCode.UPSTREAM_RATE_LIMIT,
  };
  let code: FaultCode = FaultCode.UPSTREAM_UNAVAILABLE;
  if (error.code === "UPSTREAM_REDIRECT") {
    code = FaultCode.UPSTREAM_REDIRECT;
  } else if (error.code === "UPSTREAM_TOO_LARGE") {
    code = FaultCode.UPSTREAM_TOO_LARGE;
  } else if (error.code === "ETIMEDOUT") {
    code = FaultCode.UPSTREAM_TIMEOUT;
  } else if (error.code === "ERR_BODY_PARSE_FAILURE") {
    code = FaultCode.INVALID_RESPONSE;
  } else if (status && status >= 400) {
    const fallback =
      status >= 500
        ? FaultCode.UPSTREAM_ERROR
        : FaultCode.UPSTREAM_INVALID_REQUEST;
    code = codes[status] ?? fallback;
  }
  const fault = new Fault(code);
  const retry = error.response?.headers["retry-after"];
  if (typeof retry === "string") {
    const seconds = /^\d+$/.test(retry)
      ? Number(retry)
      : Math.ceil((Date.parse(retry) - Date.now()) / 1000);
    if (Number.isFinite(seconds)) {
      fault.details = {
        retryAfterSeconds: Math.max(0, Math.min(seconds, 86400)),
      };
    }
  }
  throw fault;
}

export async function connectToken(credentials: Credentials, itemId?: string) {
  const result = await tryCatch(
    sdkResult(
      pluggyClient(credentials, 16384).createConnectToken(itemId, {
        avoidDuplicates: true,
      }),
    ),
  );
  if (result.error) {
    if (
      result.error instanceof Fault &&
      (result.error.code === FaultCode.UPSTREAM_AUTH ||
        result.error.code === FaultCode.UPSTREAM_FORBIDDEN)
    ) {
      throw result.error;
    }
    throw new Error(
      result.error instanceof Fault &&
        result.error.code === FaultCode.UPSTREAM_RATE_LIMIT
        ? "CONNECT_RATE_LIMIT"
        : "CONNECT_TOKEN_FAILED",
    );
  }
  return z
    .object({ accessToken: z.string().min(1).max(12000) })
    .parse(result.data);
}

export const connectionSource: ConnectionSource = {
  async readItem(credentials, itemId) {
    const item = z
      .object({
        id: z.string(),
        connector: z
          .object({ id: z.union([z.number(), z.string()]) })
          .optional(),
      })
      .parse(await sdkResult(pluggyClient(credentials).fetchItem(itemId)));
    return {
      id: item.id,
      ...(item.connector ? { connector: item.connector } : {}),
    };
  },
};

export async function readAccount(client: PluggyClient, accountId: string) {
  const record = ProviderRecordSchema.parse(
    await sdkResult(client.fetchAccount(accountId)),
  );
  if (record.id !== accountId) {
    throw new Error("SOURCE_SCOPE_MISMATCH");
  }
  return record;
}

const PageSchema = z.object({
  results: z.array(ProviderRecordSchema).max(1000),
  next: z.unknown().optional(),
  page: z.coerce.number().int().positive().default(1),
  totalPages: z.coerce.number().int().nonnegative().optional(),
  total: z.coerce.number().int().nonnegative().optional(),
});
const TransactionPageSchema = PageSchema.extend({
  results: z
    .array(
      ProviderRecordSchema.extend({ createdAt: z.iso.datetime().nullish() }),
    )
    .max(1000),
});
const paged: Resource[] = [
  "resources",
  "investments",
  "investment_transactions",
  "bills",
];

export function financialSource(client: PluggyClient): FinancialSource {
  return {
    async page({ resource, item, parent, cursor, floor, connectorId }) {
      const options = { page: Number(cursor ?? 1), pageSize: 100 };
      const operations = {
        connections: () => client.fetchItem(item),
        resources: () => client.fetchItemResources(item, options),
        connectors: () =>
          client.fetchConnector(
            z.coerce.number().int().positive().parse(connectorId),
          ),
        consents: () => client.fetchConsents(item),
        accounts: () => client.fetchAccounts(item),
        transactions: () =>
          client.fetchTransactionsCursor(parent, {
            ...(floor ? { createdAtFrom: floor } : {}),
            ...(cursor ? { after: cursor } : {}),
          }),
        investments: () => client.fetchInvestments(item, undefined, options),
        investment_transactions: () =>
          client.fetchInvestmentTransactions(parent, options),
        bills: () => client.fetchCreditCardBills(parent, options),
        loans: () => client.fetchLoans(item),
        identity: () => client.fetchIdentityByItemId(item),
        categories: () => client.fetchCategories(),
        statements: () => client.fetchAccountStatements(parent),
      };
      // SDK types describe its default date/number parser; our parser returns raw JSON.
      // Parse at this boundary instead of letting SDK models enter financial logic.
      const raw: unknown = await sdkResult<unknown>(operations[resource]());
      if (["connections", "identity", "connectors"].includes(resource)) {
        const record = ProviderRecordSchema.parse(raw);
        assertRecordScope(record, { resource, item, connectorId });
        return { records: [record], next: null };
      }
      const data = (
        resource === "transactions" ? TransactionPageSchema : PageSchema
      ).parse(raw);
      const records = data.results;
      assertPageScope(records, { resource, item, parent });
      if (resource === "transactions") {
        return {
          records,
          next: validateCursor(data.next, parent, cursor, floor),
        };
      }
      const { page, totalPages, total } = data;
      if (
        totalPages === undefined ||
        total === undefined ||
        page !== Number(cursor ?? 1) ||
        total < records.length ||
        (total > 0 && totalPages === 0)
      ) {
        throw new Error("INVALID_PAGE");
      }
      if (
        page < totalPages &&
        (!paged.includes(resource) || records.length === 0)
      ) {
        throw new Error("PAGINATION_UNDOCUMENTED_OR_INCOMPLETE");
      }
      return {
        records,
        next: page < totalPages ? String(page + 1) : null,
        total,
      };
    },
    async ids(account, ids) {
      if (ids.length > 500 || ids.length === 0) {
        throw new Error("IDS_LIMIT");
      }
      const data = PageSchema.parse(
        await sdkResult(client.fetchTransactionsCursor(account, { ids })),
      );
      if (data.next !== null) {
        throw new Error("IDS_RESPONSE_INCOMPLETE");
      }
      if (
        data.results.some(
          (r) => r.accountId !== account || !ids.includes(String(r.id ?? "")),
        )
      ) {
        throw new Error("IDS_SCOPE_MISMATCH");
      }
      return data.results;
    },
  };
}
function validateCursor(
  value: unknown,
  account: string,
  previous: string | null,
  floor: string | null = null,
) {
  if (value === null) {
    return null;
  }
  const text = z.string().max(4096).parse(value);
  if (!text.startsWith("?") || text.includes("#")) {
    throw new Error("INVALID_CURSOR");
  }
  const q = new URLSearchParams(text);
  if (
    q.get("accountId") !== account ||
    (q.has("createdAtFrom") && q.get("createdAtFrom") !== floor) ||
    [...q.keys()].some(
      (k) => !["accountId", "after", "createdAtFrom"].includes(k),
    ) ||
    [...q.keys()].some((k) => q.getAll(k).length !== 1)
  ) {
    throw new Error("CURSOR_SCOPE_MISMATCH");
  }
  const next = q.get("after");
  if (!next || next === previous) {
    throw new Error("CURSOR_LOOP");
  }
  return next;
}

// A 429 acknowledgement is a durable step result; wait outside the billed step.
export function providerRetries(steps: Steps): Steps {
  return {
    sleep: (name, duration) => steps.sleep(name, duration),
    async do<T extends StepValue<T>>(
      name: string,
      callback: () => Promise<T>,
    ): Promise<T> {
      for (let attempt = 0; attempt < 7; attempt++) {
        const outcome = await steps.do(
          `${name}-attempt-${attempt}`,
          async () => {
            const result = await tryCatch(callback());
            if (!result.error) {
              return { kind: "success" as const, value: result.data };
            }
            if (
              !(result.error instanceof Fault) ||
              result.error.code !== FaultCode.UPSTREAM_RATE_LIMIT
            ) {
              throw result.error;
            }
            return {
              kind: "retry" as const,
              seconds: Math.max(
                1,
                Math.min(
                  86400,
                  result.error.details?.retryAfterSeconds ?? 10 * 2 ** attempt,
                ),
              ),
            };
          },
        );
        if (outcome.kind === "success") {
          return outcome.value;
        }
        await steps.sleep(
          `${name}-rate-limit-${attempt}`,
          `${Math.ceil(outcome.seconds)} seconds`,
        );
      }
      throw new Error("UPSTREAM_RATE_LIMIT_RETRIES_EXHAUSTED");
    },
  };
}

function assertPageScope(
  records: Awaited<ReturnType<FinancialSource["ids"]>>,
  {
    resource,
    item,
    parent,
  }: Pick<
    Parameters<FinancialSource["page"]>[0],
    "resource" | "item" | "parent"
  >,
) {
  const def = DEFINITIONS[resource];
  if (
    records.some(
      (record) =>
        (record.itemId !== undefined && record.itemId !== item) ||
        (def.parent === "accounts" &&
          record.accountId !== undefined &&
          record.accountId !== parent) ||
        (def.parent === "investments" &&
          record.investmentId !== undefined &&
          record.investmentId !== parent),
    )
  ) {
    throw new Error("SOURCE_SCOPE_MISMATCH");
  }
}

function assertRecordScope(
  record: z.infer<typeof ProviderRecordSchema>,
  {
    resource,
    item,
    connectorId,
  }: Pick<
    Parameters<FinancialSource["page"]>[0],
    "resource" | "item" | "connectorId"
  >,
) {
  if (
    (resource === "connections" && record.id !== item) ||
    (resource === "connectors" && String(record.id) !== connectorId) ||
    (record.itemId !== undefined && record.itemId !== item)
  ) {
    throw new Error("SOURCE_SCOPE_MISMATCH");
  }
}
