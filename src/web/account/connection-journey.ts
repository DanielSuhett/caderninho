export interface ConnectionActivity {
  profileId: string;
  stage: "opening" | "widget" | "registering";
}

export const AddBankAction = {
  Connect: "connect",
  Credentials: "credentials",
  Paused: "paused",
  Person: "person",
} as const;
export type AddBankAction = (typeof AddBankAction)[keyof typeof AddBankAction];

// A configured access is reused; credentials are only asked while none exists.
export function addBankAction(input: {
  person: object | undefined;
  profile: { configured: boolean; enabled: boolean } | undefined;
}): AddBankAction {
  if (!input.person) {
    return AddBankAction.Person;
  }
  if (!input.profile?.configured) {
    return AddBankAction.Credentials;
  }
  if (!input.profile.enabled) {
    return AddBankAction.Paused;
  }
  return AddBankAction.Connect;
}

export function importFailureMessage(code: string | null) {
  if (code === "ACCOUNT_ALREADY_CONNECTED") {
    return "Esta conta já está conectada em outra conexão, então nada foi importado. Para atualizá-la, use Reautorizar na conexão existente.";
  }
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
