import type { AccountMap } from "./finance.entity";
import type { RunStatus } from "./sync.entity";

// The source validates the personal-use connector selected by the widget.
export const PERSONAL_CONNECTOR_ID = 200;

export const MAX_PERSONAL_CONNECTIONS = 10;

export function assertPersonalConnector(id: number | string | undefined) {
  if (id !== PERSONAL_CONNECTOR_ID && id !== String(PERSONAL_CONNECTOR_ID)) {
    throw new Error("MEU_PLUGGY_REQUIRED");
  }
}

export function assertConnectionCapacity({
  count,
  exists,
}: {
  count: number;
  exists: boolean;
}) {
  if (count >= MAX_PERSONAL_CONNECTIONS && !exists) {
    throw new Error("ITEM_LIMIT");
  }
}

// A successful import cannot promise complete data for an unread balance/account.
export function connectionPartial(connection: {
  accounts: AccountMap;
  importStatus: RunStatus | null;
  importAdmittedAt: string | null;
  lastSuccessAt: string | null;
}) {
  return (
    connection.importStatus !== "succeeded" ||
    !connection.lastSuccessAt ||
    !!(
      connection.importAdmittedAt &&
      connection.importAdmittedAt > connection.lastSuccessAt
    ) ||
    Object.values(connection.accounts).some(
      (account) =>
        !account.balanceObservedAt ||
        !!(
          connection.importAdmittedAt &&
          account.balanceObservedAt < connection.importAdmittedAt
        ),
    )
  );
}
