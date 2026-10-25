import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerDialog } from "@cloudflare/kumo/components/layer-dialog";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { UiButton } from "../ui";
import { guardWorkspaceNavigation } from "./account-navigation";

export function BackofficeDialog({
  open,
  title,
  children,
  primaryAction,
  actionHint,
  dirty,
  busy,
  close,
  presentation = "editor",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  primaryAction: ComponentProps<typeof LayerDialog.Actions.Primary>;
  actionHint?: ReactNode;
  dirty: boolean;
  busy: boolean;
  close: () => void;
  presentation?: "editor" | "confirmation" | "compact-editor";
}) {
  const editingBody = useRef<HTMLDivElement>(null);
  const editingFocus = useRef<HTMLElement | null>(null);
  const discardNotice = useRef<HTMLDivElement>(null);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (discard) {
      discardNotice.current?.scrollIntoView({ block: "nearest" });
      discardNotice.current?.querySelector("button")?.focus();
    }
  }, [discard]);
  useEffect(() => {
    if (!open) {
      return;
    }
    setDiscard(false);
    if (presentation !== "confirmation") {
      return;
    }
    const frame = requestAnimationFrame(() =>
      editingBody.current
        ?.closest('[role="dialog"], [role="alertdialog"]')
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, presentation]);
  useEffect(() => {
    if (!(open && dirty)) {
      return;
    }
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty, open]);
  const requestClose = useCallback(() => {
    if (busy) {
      return;
    }
    if (dirty) {
      if (document.activeElement instanceof HTMLElement) {
        editingFocus.current = document.activeElement;
      }
      setDiscard(true);
      return;
    }
    close();
  }, [busy, dirty, close]);
  useEffect(() => {
    if (!open) {
      return;
    }
    return guardWorkspaceNavigation(() => {
      if (dirty || busy) {
        requestClose();
        return false;
      }
      return true;
    });
  }, [dirty, busy, requestClose, open]);
  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        requestClose();
      }
    },
    [requestClose],
  );
  const continueEditing = useCallback(() => {
    setDiscard(false);
    requestAnimationFrame(() => {
      const previous = editingFocus.current;
      if (previous?.isConnected && editingBody.current?.contains(previous)) {
        previous.focus();
        return;
      }
      editingBody.current
        ?.querySelector<HTMLElement>("input,button[role=combobox]")
        ?.focus();
    });
  }, []);
  const DialogRoot =
    presentation === "confirmation" ? LayerDialog.Alert : LayerDialog.Root;
  return (
    <DialogRoot
      dismissDisabled={busy || discard}
      onOpenChange={onOpenChange}
      open={open}
    >
      <LayerDialog.Content size={presentation === "editor" ? "lg" : "base"}>
        <LayerDialog.Title>
          <span className="text-xl">{title}</span>
        </LayerDialog.Title>
        <LayerDialog.Body>
          {!!discard && (
            <div ref={discardNotice}>
              <Banner
                description="Suas alterações ainda não foram salvas."
                title="Descartar as alterações?"
                variant="alert"
              />
              <div className="draft-actions">
                <UiButton
                  onClick={continueEditing}
                  type="button"
                  variant="secondary"
                >
                  Continuar editando
                </UiButton>
                <UiButton
                  onClick={close}
                  type="button"
                  variant="destructive"
                >
                  Descartar alterações
                </UiButton>
              </div>
            </div>
          )}
          <div
            inert={discard}
            ref={editingBody}
          >
            {children}
            {actionHint}
          </div>
        </LayerDialog.Body>
        <LayerDialog.Actions dismissLabel="Cancelar">
          <LayerDialog.Actions.Primary
            {...primaryAction}
            disabled={busy || discard || primaryAction.disabled}
          />
        </LayerDialog.Actions>
      </LayerDialog.Content>
    </DialogRoot>
  );
}
