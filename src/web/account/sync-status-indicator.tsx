import { Button } from "@cloudflare/kumo/components/button";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Popover } from "@cloudflare/kumo/components/popover";
import { ClockIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { createContext, useContext, useEffect, useState } from "react";

import { synchronizationStatus, syncRecentDuration } from "./sync-status";
import { dayLabel, momentLabel } from "./workspace-resource";

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
  return (
    <Popover>
      <Popover.Trigger
        openOnHover
        render={
          <Button
            aria-busy={status.state === "syncing"}
            aria-label={status.label}
            className="sync-status-trigger"
            data-state={status.state}
            shape="square"
            size="base"
            type="button"
            variant="ghost"
          />
        }
      >
        {icon}
      </Popover.Trigger>
      <Popover.Content
        align="end"
        className="sync-status-panel"
      >
        <Popover.Title>{status.label}</Popover.Title>
        <Popover.Description>
          {source.demo
            ? "Dados fictícios de "
            : "Última importação concluída: "}
          {source.updatedAt ? (
            <time dateTime={source.updatedAt}>
              {source.updatedAt.length > 10
                ? momentLabel(source.updatedAt)
                : dayLabel(source.updatedAt)}
            </time>
          ) : (
            "ainda não registrada"
          )}
          .
        </Popover.Description>
      </Popover.Content>
    </Popover>
  );
}
