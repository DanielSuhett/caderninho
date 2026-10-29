import { Badge } from "@cloudflare/kumo/components/badge";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";

import { momentLabel } from "./workspace-resource";

export const syncStatuses = {
  failed: "Falhou",
  pending: "Na fila",
  running: "Em andamento",
  succeeded: "Concluída",
};
const phases: Record<string, string> = {
  accounts: "Contas",
  bills: "Faturas",
  finish: "Conferência final",
  investments: "Investimentos",
  loans: "Empréstimos",
  transactions: "Transações",
};

export function finishLabel(finishedAt: string | null, status: string) {
  if (finishedAt) {
    return momentLabel(finishedAt);
  }
  return status === "pending" || status === "running"
    ? "Ainda em andamento"
    : "Horário não disponível";
}

// Success stays quiet; anything else keeps its badge and explains itself.
export function SyncStatus({
  record,
}: {
  record: {
    status: keyof typeof syncStatuses;
    phase: string | null;
    error: string | null;
  };
}) {
  if (record.status === "succeeded") {
    return (
      <span className="sync-done">
        <span
          aria-hidden
          className="setup-connected"
        />
        {syncStatuses[record.status]}
      </span>
    );
  }
  const badge = (
    <Badge
      variant={
        (
          {
            failed: "error",
            pending: "warning",
            running: "info",
          } as const
        )[record.status]
      }
    >
      {syncStatuses[record.status]}
    </Badge>
  );
  const detail = record.error
    ? `Interrompida: ${record.error}. Dados confirmados preservados.`
    : record.phase && (phases[record.phase] ?? record.phase);
  if (!detail) {
    return badge;
  }
  return (
    <Tooltip
      content={detail}
      render={<span className="sync-status-detail">{badge}</span>}
    />
  );
}
