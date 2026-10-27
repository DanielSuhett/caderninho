import {
  type ComponentProps,
  lazy,
  Suspense,
  useCallback,
  useState,
} from "react";

import type { PortalCard, PortalCards, PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import type { OrganizationApi } from "./account-api";
import type { CardEditor as CardEditorComponent } from "./card-edit-dialog";
import type { CardLimitEditor as EditorComponent } from "./card-limit-dialog";
import { CardsDashboard } from "./cards-dashboard";
import { WorkspacePageError } from "./workspace-page";

const CardLimitEditor = lazy<typeof EditorComponent>(async () => {
  const { data, error } = await tryCatch(() => import("./card-limit-dialog"));
  return { default: error ? WorkspacePageError : data.CardLimitEditor };
});

const CardEditor = lazy<typeof CardEditorComponent>(async () => {
  const { data, error } = await tryCatch(() => import("./card-edit-dialog"));
  return { default: error ? WorkspacePageError : data.CardEditor };
});

export function CardsWithLimitEditor({
  api,
  snapshot,
  spaceId,
  revision,
  saved,
  ...props
}: Omit<ComponentProps<typeof CardsDashboard>, "onEditCard" | "onEditLimit"> & {
  api: Pick<OrganizationApi, "planning">;
  snapshot: PortalResponse;
  spaceId: string;
  revision: number | undefined;
  saved: () => void;
}) {
  const [editing, setEditing] = useState<{
    account: PortalCards["accounts"][number];
    revision: number;
  } | null>(null);
  const [editingCard, setEditingCard] = useState<{
    card: PortalCard;
    revision: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [session, setSession] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const closeCard = useCallback(() => setCardOpen(false), []);
  const onSaved = useCallback(() => {
    setOpen(false);
    saved();
  }, [saved]);
  const onCardSaved = useCallback(() => {
    setCardOpen(false);
    saved();
  }, [saved]);
  const editCard = useCallback(
    (card: PortalCard) => {
      if (revision === undefined) {
        return;
      }
      setEditingCard({ card, revision });
      setSession((value) => value + 1);
      setCardOpen(true);
    },
    [revision],
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
        onEditCard={revision === undefined ? undefined : editCard}
        onEditLimit={revision === undefined ? undefined : edit}
      />
      {!!editingCard && (
        <Suspense fallback={null}>
          <CardEditor
            api={api}
            card={editingCard.card}
            close={closeCard}
            key={`card-${session}`}
            open={cardOpen}
            revision={editingCard.revision}
            saved={onCardSaved}
            snapshot={snapshot}
            spaceId={spaceId}
          />
        </Suspense>
      )}
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
