import {
  type ComponentProps,
  lazy,
  Suspense,
  useCallback,
  useState,
} from "react";

import type { PortalCards, PortalResponse } from "../../contracts";
import { TransactionOrder } from "../../domain";
import { tryCatch } from "../../shared";
import type { OrganizationApi } from "./account-api";
import type { CardLimitEditor as EditorComponent } from "./card-limit-dialog";
import type { ReadCardTransactions } from "./card-transactions";
import { CardsDashboard } from "./cards-dashboard";
import { monthPeriod } from "./dashboard-period";
import { WorkspacePageError } from "./workspace-page";

const CardLimitEditor = lazy<typeof EditorComponent>(async () => {
  const { data, error } = await tryCatch(() => import("./card-limit-dialog"));
  return { default: error ? WorkspacePageError : data.CardLimitEditor };
});

export function CardsWithLimitEditor({
  api,
  snapshot,
  spaceId,
  revision,
  saved,
  ...props
}: Omit<
  ComponentProps<typeof CardsDashboard>,
  "onEditLimit" | "readTransactions"
> & {
  api: Pick<OrganizationApi, "planning" | "query">;
  snapshot: PortalResponse;
  spaceId: string;
  revision: number | undefined;
  saved: () => void;
}) {
  const [editing, setEditing] = useState<{
    account: PortalCards["accounts"][number];
    revision: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const onSaved = useCallback(() => {
    setOpen(false);
    saved();
  }, [saved]);
  const { month } = props.data;
  const readTransactions = useCallback<ReadCardTransactions>(
    ({ accountId, cardId }, signal, fresh) =>
      api.query(
        {
          ...monthPeriod(month),
          accountId,
          cardId,
          limit: 50,
          order: TransactionOrder.date_desc,
          spaceId,
          tool: "get_portal_transactions",
        },
        snapshot.csrf,
        signal,
        fresh,
      ),
    [api, month, snapshot.csrf, spaceId],
  );
  const edit = useCallback(
    (account: PortalCards["accounts"][number]) => {
      if (revision === undefined) {
        return;
      }
      setEditing({ account, revision });
      setSession((value) => value + 1);
      setOpen(true);
    },
    [revision],
  );
  return (
    <>
      <CardsDashboard
        {...props}
        onEditLimit={revision === undefined ? undefined : edit}
        readTransactions={readTransactions}
      />
      {!!editing && (
        <Suspense fallback={null}>
          <CardLimitEditor
            account={editing.account}
            api={api}
            close={close}
            key={session}
            open={open}
            revision={editing.revision}
            saved={onSaved}
            snapshot={snapshot}
            spaceId={spaceId}
          />
        </Suspense>
      )}
    </>
  );
}
