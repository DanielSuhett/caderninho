import { XIcon } from "@phosphor-icons/react";
import {
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { UiButton } from "../ui";
import { guardWorkspaceNavigation } from "./account-navigation";

export function BackofficeDialog({
  title,
  children,
  footer,
  dirty,
  busy,
  close,
  presentation = "editor",
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  dirty: boolean;
  busy: boolean;
  close: () => void;
  presentation?: "editor" | "confirmation" | "compact-editor";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelAction = useRef<HTMLButtonElement>(null);
  const id = useId();
  const discardNotice = useRef<HTMLDivElement>(null);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (discard) {
      discardNotice.current?.scrollIntoView({ block: "nearest" });
      discardNotice.current?.querySelector("button")?.focus();
    }
  }, [discard]);
  useEffect(() => {
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    if (presentation === "confirmation") {
      cancelAction.current?.focus();
    }
    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      } else {
        document.querySelector<HTMLElement>("#workspace-content")?.focus();
      }
    };
  }, [presentation]);
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const requestClose = useCallback(() => {
    if (busy) {
      return;
    }
    if (dirty) {
      setDiscard(true);
    } else {
      close();
    }
  }, [busy, dirty, close]);
  useEffect(
    () =>
      guardWorkspaceNavigation(() => {
        if (dirty || busy) {
          requestClose();
          return false;
        }
        return true;
      }),
    [dirty, busy, requestClose],
  );
  const cancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      requestClose();
    },
    [requestClose],
  );
  const continueEditing = useCallback(() => setDiscard(false), []);
  return (
    <dialog
      aria-labelledby={id}
      className={`workspace-drawer backoffice-drawer ${{ "compact-editor": "backoffice-compact-editor", confirmation: "backoffice-confirmation", editor: "" }[presentation]}`}
      onCancel={cancel}
      ref={dialog}
    >
      <header className="drawer-heading">
        <h2 id={id}>{title}</h2>
        <UiButton
          aria-label="Fechar editor"
          className="icon-button"
          disabled={busy}
          onClick={requestClose}
          type="button"
          variant="secondary"
        >
          <XIcon size={20} />
        </UiButton>
      </header>
      <div className="drawer-body">
        {!!discard && (
          <div
            className="notice"
            ref={discardNotice}
            role="alert"
          >
            <p>Descartar as alterações ainda não salvas?</p>
            <UiButton
              onClick={continueEditing}
              type="button"
              variant="secondary"
            >
              Continuar editando
            </UiButton>
            <UiButton
              onClick={close}
              tone="danger"
              type="button"
            >
              Descartar alterações
            </UiButton>
          </div>
        )}
        <div inert={discard}>{children}</div>
      </div>
      <footer
        className="drawer-footer"
        inert={discard}
      >
        {footer}
        <UiButton
          disabled={busy}
          onClick={requestClose}
          ref={cancelAction}
          type="button"
          variant="secondary"
        >
          Cancelar
        </UiButton>
      </footer>
    </dialog>
  );
}
