import { Toolbar } from "@cloudflare/kumo/components/toolbar";
import { type ReactNode, useCallback, useState } from "react";

import { deferred, prefetch, useShown } from "./deferred";

const loadPanel = async () =>
  (await import("./filter-dialog-panel")).FilterDialogPanel;
const Panel = deferred(loadPanel);
const warm = () => prefetch(loadPanel);

export function FilterDialog({
  title,
  trigger,
  children,
  formId,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  formId: string;
}) {
  const [open, setOpen] = useState(false);
  const shown = useShown(open);
  const show = useCallback(() => setOpen(true), []);
  return (
    <>
      <Toolbar.Button
        aria-haspopup="dialog"
        onClick={show}
        onFocus={warm}
        onPointerEnter={warm}
        type="button"
      >
        {trigger}
      </Toolbar.Button>
      {shown === true && (
        <Panel
          formId={formId}
          open={open}
          setOpen={setOpen}
          title={title}
        >
          {children}
        </Panel>
      )}
    </>
  );
}
