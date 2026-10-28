import type { PortalResponse, WorkspaceCatalog } from "../../contracts";
import type { OrganizationApi } from "./account-api";
import { DeleteOrganizationItem, GroupEditor } from "./group-editor";
import { RuleEditor } from "./rule-editor";

export function OrganizationEditors({
  api,
  close,
  data,
  editor,
  open,
  saved,
  session,
  snapshot,
  spaceId,
}: {
  api: OrganizationApi;
  close: () => void;
  data: WorkspaceCatalog & {
    accounts: {
      id: string;
      name: string;
      personId: string;
      personName: string;
    }[];
  };
  editor: { kind: "rule" | "space"; id?: string; remove?: boolean } | null;
  open: boolean;
  saved: () => void;
  session: number;
  snapshot: PortalResponse;
  spaceId: string;
}) {
  const rule = data.rules.find((row) => row.id === editor?.id);
  const space = data.spaces.find((row) => row.id === editor?.id);
  return (
    <>
      <RuleEditor
        accounts={data.accounts}
        api={api}
        catalog={data}
        close={close}
        key={`rule-${session}`}
        open={open && editor?.kind === "rule" && !editor.remove}
        {...(rule && { rule })}
        saved={saved}
        snapshot={snapshot}
        spaceId={spaceId}
      />
      <GroupEditor
        api={api}
        close={close}
        key={`group-${session}`}
        open={open && editor?.kind === "space" && !editor.remove}
        saved={saved}
        snapshot={snapshot}
        {...(space && { space })}
      />
      <DeleteOrganizationItem
        api={api}
        close={close}
        deleted={saved}
        item={(editor?.kind === "rule" ? rule : space) ?? { id: "", name: "" }}
        key={`delete-${session}`}
        kind={editor?.kind ?? "rule"}
        open={open && !!editor?.remove}
        snapshot={snapshot}
        spaceId={editor?.kind === "space" ? (editor.id ?? spaceId) : spaceId}
      />
    </>
  );
}
