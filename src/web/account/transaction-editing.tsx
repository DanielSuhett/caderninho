import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";

import type { PortalResponse, WorkspaceCatalog } from "../../contracts";
import { tryCatch } from "../../shared";
import type { OrganizationApi } from "./account-api";
import {
  type EditableTransaction,
  TransactionEditingContext,
} from "./transaction-actions";
import type { TransactionEditors as EditorsComponent } from "./transaction-editors";
import { WorkspacePageError } from "./workspace-page";

const loadEditors = async () => {
  const { data, error } = await tryCatch(() => import("./transaction-editors"));
  return { default: error ? WorkspacePageError : data.TransactionEditors };
};
const TransactionEditors = lazy<typeof EditorsComponent>(loadEditors);

type Action = "category" | "rule";

export function TransactionEditing({
  api,
  snapshot,
  catalog,
  accounts,
  revision,
  spaceId,
  saved,
  children,
}: {
  api: OrganizationApi;
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  accounts: {
    id: string;
    name: string;
    personId?: string;
    personName?: string;
  }[];
  revision: number | undefined;
  spaceId: string;
  saved?: () => void;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<{
    row: EditableTransaction;
    action: Action;
    revision: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const { add: notify } = useKumoToastManager();
  const choose = useCallback(
    (row: EditableTransaction, action: Action) => {
      if (revision === undefined) {
        return;
      }
      setSelection({ action, revision, row });
      setSession((value) => value + 1);
      setOpen(true);
    },
    [revision],
  );
  const close = useCallback(() => setOpen(false), []);
  const onSaved = useCallback(() => {
    setOpen(false);
    notify({
      title:
        selection?.action === "rule"
          ? "Regra criada para as próximas importações."
          : "Categoria salva.",
      variant: "success",
    });
    saved?.();
  }, [notify, saved, selection]);
  const accountChoices = useMemo(
    () =>
      accounts.map((account) => ({
        id: account.id,
        name: account.name,
        personName:
          account.personName ??
          snapshot.people.find((person) => person.id === account.personId)
            ?.name ??
          "Pessoa indisponível",
      })),
    [accounts, snapshot.people],
  );
  return (
    <TransactionEditingContext.Provider
      value={revision === undefined ? null : choose}
    >
      {children}
      {!!selection && (
        <Suspense fallback={null}>
          <TransactionEditors
            accounts={accountChoices}
            action={selection.action}
            api={api}
            catalog={catalog}
            close={close}
            open={open}
            revision={selection.revision}
            row={selection.row}
            saved={onSaved}
            session={session}
            snapshot={snapshot}
            spaceId={spaceId}
          />
        </Suspense>
      )}
    </TransactionEditingContext.Provider>
  );
}
