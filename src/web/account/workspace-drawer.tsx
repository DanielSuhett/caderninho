import { XIcon } from "@phosphor-icons/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { UiButton } from "../ui";

// Native modal semantics provide focus containment, Escape and inert background.
export function WorkspaceDrawer({
  title,
  trigger,
  children,
  footer,
  side = "right",
  className = "",
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => dialog.current?.close(), []);
  const closed = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <div className={`drawer-control ${className}`}>
      <UiButton
        aria-controls={id}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={show}
        type="button"
        variant="secondary"
      >
        {trigger}
      </UiButton>
      <dialog
        aria-labelledby={`${id}-title`}
        className={`workspace-drawer drawer-${side}`}
        id={id}
        onClose={closed}
        ref={dialog}
      >
        {!!open && (
          <>
            <header className="drawer-heading">
              <h2 id={`${id}-title`}>{title}</h2>
              <UiButton
                aria-label={`Fechar ${title.toLocaleLowerCase("pt-BR")}`}
                className="icon-button"
                onClick={close}
                type="button"
                variant="secondary"
              >
                <XIcon
                  aria-hidden="true"
                  size={20}
                />
              </UiButton>
            </header>
            <div className="drawer-body">{children}</div>
            <footer className="drawer-footer">
              {footer}
              <UiButton
                onClick={close}
                type="button"
                variant="secondary"
              >
                {side === "left" ? "Fechar menu" : "Cancelar"}
              </UiButton>
            </footer>
          </>
        )}
      </dialog>
    </div>
  );
}
