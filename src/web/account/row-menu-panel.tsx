import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Fragment, useEffect, useRef } from "react";

import { UiButton } from "../ui";
import type { RowMenuItem } from "./row-menu";

export function RowMenuPanel({
  label,
  items,
  open,
  focus,
  hover,
}: {
  label: string;
  items: RowMenuItem[];
  open: boolean;
  focus: boolean;
  // Mounted under the pointer: the hover that would open the tooltip is over.
  hover: boolean;
  // Used by the loading placeholder, which stays clickable.
  onOpen: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  // The light trigger was replaced; keep keyboard focus where the user left it.
  useEffect(() => {
    if (focus && !open) {
      trigger.current?.focus();
    }
  }, [focus, open]);
  return (
    <DropdownMenu defaultOpen={open}>
      <Tooltip
        content={label}
        defaultOpen={hover}
        render={
          <DropdownMenu.Trigger
            render={
              <UiButton
                aria-label={label}
                ref={trigger}
                shape="square"
                type="button"
                variant="ghost"
              />
            }
          >
            <DotsThreeIcon
              aria-hidden
              size={20}
            />
          </DropdownMenu.Trigger>
        }
      />
      <DropdownMenu.Content>
        {items.map(({ key, label: text, icon, href, separated, ...item }) => (
          <Fragment key={key}>
            {separated === true && <DropdownMenu.Separator />}
            {href ? (
              <DropdownMenu.LinkItem href={href}>{text}</DropdownMenu.LinkItem>
            ) : (
              <DropdownMenu.Item
                {...item}
                {...(icon && { className: "flex items-center gap-2" })}
              >
                {icon}
                {text}
              </DropdownMenu.Item>
            )}
          </Fragment>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
