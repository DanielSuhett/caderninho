export interface ConnectionActivity {
  profileId: string;
  stage: "opening" | "widget" | "registering";
}

export function importFailureMessage(code: string | null) {
  const causes: Record<string, string> = {
    UPSTREAM_AUTH:
      "A origem recusou o acesso. Confira o perfil e a autorização.",
    UPSTREAM_FORBIDDEN:
      "A origem recusou o acesso. Confira o perfil e a autorização.",
    UPSTREAM_RATE_LIMIT: "O provedor limitou as consultas.",
    UPSTREAM_TIMEOUT: "O provedor demorou a responder.",
    UPSTREAM_UNAVAILABLE: "O provedor está indisponível.",
  };
  const cause = (code && causes[code]) || "A importação foi interrompida.";
  return `${cause} Os dados já publicados foram preservados. Consulte os detalhes e a próxima elegibilidade antes de repetir.`;
}
