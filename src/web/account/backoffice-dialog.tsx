import { Banner } from "@cloudflare/kumo/components/banner";
import { Dialog } from "@cloudflare/kumo/components/dialog";
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
import { WorkspaceDialog } from "./workspace-dialog";

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
  primaryAction: ComponentProps<typeof UiButton>;
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
  return (
    <Dialog.Root
      onOpenChange={onOpenChange}
      open={open}
      role={presentation === "confirmation" ? "alertdialog" : "dialog"}
    >
      <WorkspaceDialog
        actions={
          <>
            <UiButton
              disabled={busy || discard}
              onClick={requestClose}
              type="button"
              variant="secondary"
            >
              Cancelar
            </UiButton>
            <UiButton
              {...primaryAction}
              disabled={busy || discard || primaryAction.disabled}
              variant={primaryAction.variant ?? "primary"}
            />
          </>
        }
        busy={busy || discard}
        showClose={presentation !== "confirmation"}
        size={presentation === "editor" ? "xl" : "lg"}
        title={title}
      >
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
          className="workspace-editor-body"
          inert={discard}
          ref={editingBody}
        >
          {children}
          {actionHint}
        </div>
      </WorkspaceDialog>
    </Dialog.Root>
  );
}
