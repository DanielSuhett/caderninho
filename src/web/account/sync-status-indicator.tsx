import { Button } from "@cloudflare/kumo/components/button";
import { Loader } from "@cloudflare/kumo/components/loader";
import { ClockIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { createContext, useContext, useEffect, useState } from "react";

import { deferred, useIntent } from "./deferred";
import { synchronizationStatus, syncRecentDuration } from "./sync-status";

const loadPopover = async () =>
  (await import("./sync-status-popover")).SyncStatusPopover;
const SyncStatusPopover = deferred(loadPopover, ({ icon, label, trigger }) => (
  <Button
    {...trigger}
    aria-haspopup="dialog"
    aria-label={label}
    shape="square"
    size="base"
    type="button"
    variant="ghost"
  >
    {icon}
  </Button>
));

export const SyncStatusContext = createContext<{
  updatedAt?: string | null | undefined;
  syncing?: boolean | undefined;
  failed?: boolean | undefined;
  unavailable?: boolean | undefined;
  demo?: boolean | undefined;
}>({});

export function SyncStatusIndicator() {
  const source = useContext(SyncStatusContext);
  const [now, setNow] = useState(Date.now);
  const status = synchronizationStatus({ ...source, now });
  const { hover, intent, open, warm } = useIntent(loadPopover);
  useEffect(() => {
    const remaining =
      (source.updatedAt ? Date.parse(source.updatedAt) : 0) +
      syncRecentDuration -
      Date.now();
    setNow(Date.now());
    if (source.demo || !(remaining > 0 && remaining <= syncRecentDuration)) {
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), remaining + 1);
    return () => clearTimeout(timer);
  }, [source.demo, source.updatedAt]);
  let icon = (
    <ClockIcon
      aria-hidden
      size={20}
    />
  );
  if (status.state === "failed" || status.state === "unavailable") {
    icon = (
      <WarningCircleIcon
        aria-hidden
        size={20}
      />
    );
  }
  if (source.syncing && !source.demo) {
    icon = <Loader aria-label="Sincronizando" />;
  }
  const trigger = {
    "aria-busy": status.state === "syncing",
    "aria-label": status.label,
    className: "sync-status-trigger",
    "data-state": status.state,
  };
  // Past idle the popover mounts under the pointer or click that asked for it.
  if (intent === "idle") {
    return (
      <Button
        {...trigger}
        aria-haspopup="dialog"
        onClick={open}
        onFocus={warm}
        onPointerEnter={hover}
        shape="square"
        size="base"
        type="button"
        variant="ghost"
      >
        {icon}
      </Button>
    );
  }
  return (
    <SyncStatusPopover
      demo={!!source.demo}
      icon={icon}
      label={status.label}
      trigger={trigger}
      updatedAt={source.updatedAt ?? null}
    />
  );
}
