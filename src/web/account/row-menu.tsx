import { DotsThreeIcon } from "@phosphor-icons/react";
import { type MouseEvent, type ReactNode, useCallback, useState } from "react";

import { UiButton } from "../ui";
import { deferred, prefetch } from "./deferred";

export interface RowMenuItem {
  disabled?: boolean;
  href?: string;
  icon?: ReactNode;
  key: string;
  label: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  separated?: boolean;
  variant?: "danger";
  [data: `data-${string}`]: string;
}

const loadPanel = async () => (await import("./row-menu-panel")).RowMenuPanel;
const warm = () => prefetch(loadPanel);

function LightTrigger({
  label,
  onClick,
  onFocus,
  onPointerEnter,
}: {
  label: string;
  onClick: () => void;
  onFocus?: () => void;
  onPointerEnter?: () => void;
}) {
  return (
    <UiButton
      aria-haspopup="menu"
      aria-label={label}
      onClick={onClick}
      {...(onFocus && { onFocus })}
      {...(onPointerEnter && { onPointerEnter })}
      shape="square"
      type="button"
      variant="ghost"
    >
      <DotsThreeIcon
        aria-hidden
        size={20}
      />
    </UiButton>
  );
}

const Panel = deferred(loadPanel, ({ label, onOpen }) => (
  <LightTrigger
    label={label}
    onClick={onOpen}
  />
));

// The trailing ⋯ of ledger rows. Lists render many of these; each row gets the
// full menu (and its tooltip) only once someone reaches for it.
export function RowMenu({
  label,
  items,
}: {
  label: string;
  items: RowMenuItem[];
}) {
  const [state, setState] = useState<"idle" | "hover" | "focus" | "open">(
    "idle",
  );
  const hover = useCallback(() => {
    warm();
    setState("hover");
  }, []);
  const focus = useCallback(() => {
    warm();
    setState("focus");
  }, []);
  const open = useCallback(() => setState("open"), []);
  if (state === "idle") {
    return (
      <LightTrigger
        label={label}
        onClick={open}
        onFocus={focus}
        onPointerEnter={hover}
      />
    );
  }
  return (
    <Panel
      focus={state === "focus"}
      hover={state === "hover"}
      items={items}
      label={label}
      onOpen={open}
      open={state === "open"}
    />
  );
}
