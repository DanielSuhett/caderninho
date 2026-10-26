export const syncRecentDuration = 3 * 60 * 1000;

export function synchronizationStatus({
  updatedAt,
  syncing = false,
  failed = false,
  unavailable = false,
  demo = false,
  now = Date.now(),
}: {
  updatedAt?: string | null | undefined;
  syncing?: boolean | undefined;
  failed?: boolean | undefined;
  unavailable?: boolean | undefined;
  demo?: boolean | undefined;
  now?: number;
}) {
  const completedAt = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const recentUntil = completedAt + syncRecentDuration;
  if (demo) {
    return { label: "Dados de demonstração", recentUntil: 0, state: "example" };
  }
  if (syncing) {
    return {
      label: "Sincronização em andamento",
      recentUntil: 0,
      state: "syncing",
    };
  }
  if (unavailable) {
    return {
      label: "Não foi possível consultar a sincronização",
      recentUntil: 0,
      state: "unavailable",
    };
  }
  if (failed) {
    return {
      label: "Uma sincronização precisa de atenção",
      recentUntil: 0,
      state: "failed",
    };
  }
  if (completedAt <= now && now < recentUntil) {
    return { label: "Sincronização concluída", recentUntil, state: "recent" };
  }
  return {
    label: updatedAt
      ? "Última sincronização"
      : "Nenhuma sincronização concluída",
    recentUntil: 0,
    state: "idle",
  };
}
