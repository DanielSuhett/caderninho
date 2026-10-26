import { createContext, type ReactNode, useCallback, useContext } from "react";

import type { PortalQueryResults } from "../../contracts";
import type { OrganizationApi } from "./account-api";

type ReadTransaction = (
  id: string,
  accountId: string,
  signal: AbortSignal,
  fresh: boolean,
) => Promise<PortalQueryResults["get_portal_transactions"]>;
export const TransactionReaderContext = createContext<ReadTransaction | null>(
  null,
);

export function TransactionReaderProvider({
  api,
  csrf,
  spaceId,
  children,
}: {
  api: Pick<OrganizationApi, "query">;
  csrf: string;
  spaceId: string;
  children: ReactNode;
}) {
  const read = useCallback<ReadTransaction>(
    (id, accountId, signal, fresh) =>
      api.query(
        {
          accountId,
          include_ignored: true,
          limit: 1,
          spaceId,
          tool: "get_portal_transactions",
          transactionId: id,
        },
        csrf,
        signal,
        fresh,
      ),
    [api, csrf, spaceId],
  );
  return (
    <TransactionReaderContext value={read}>{children}</TransactionReaderContext>
  );
}
export function useTransactionReader() {
  return useContext(TransactionReaderContext);
}
