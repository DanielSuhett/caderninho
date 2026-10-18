import type { AccountResponse } from "#contracts/portal-contract.ts";
import type { WizardIssue, WizardState } from "#contracts/wizard-contract.ts";
import { PERSONAL_CONNECTOR_ID } from "#domain/connection-policy.ts";

export type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "failed"; session: boolean };
export interface AccountState {
  snapshot: AccountResponse | undefined;
  load: LoadState;
  step: number;
  message: string;
  busy: boolean;
}
export interface AccountActions {
  refresh: () => void;
  selectStep: (step: number) => void;
  connectItem: (itemId?: string) => void;
  pauseSync: () => void;
  resumeSync: () => void;
  requestSync: () => void;
  disconnectAssistants: () => void;
  logout: () => void;
  copy: (value: string) => void;
}

export const WIZARD_ISSUES: Record<
  WizardIssue,
  { title: string; action: string }
> = {
  credentials: {
    title: "A Pluggy não reconheceu essas chaves.",
    action:
      "Confira PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets deste Worker na sua Cloudflare.",
  },
  application: {
    title: "Esta instalação já usa outra aplicação Pluggy.",
    action:
      "Configure as credenciais da aplicação original nos secrets da Cloudflare. Seu histórico foi preservado.",
  },
  rate: {
    title: "A Pluggy pediu uma pausa.",
    action:
      "Aguarde alguns minutos antes de tentar novamente. Não é necessário cadastrar tudo outra vez.",
  },
  unavailable: {
    title: "Não conseguimos conversar com a Pluggy agora.",
    action:
      "Confira sua conexão e tente novamente. As etapas salvas continuam aqui.",
  },
  item: {
    title: "Não foi possível confirmar essa conexão.",
    action:
      "Abra o Meu Pluggy novamente. Se o banco não aparecer, conecte-o primeiro em meu.pluggy.ai.",
  },
  connector: {
    title: "Esta conexão não veio do Meu Pluggy.",
    action:
      "Use a opção Meu Pluggy para importar suas conexões pessoais. Não escolha o banco diretamente no widget.",
  },
  session: {
    title: "Sua sessão precisa ser renovada.",
    action:
      "Entre novamente nesta instalação. Suas etapas salvas continuam aqui.",
  },
  unknown: {
    title: "A etapa não pôde ser concluída.",
    action:
      "Tente novamente ou copie o diagnóstico seguro para pedir ajuda à sua IA.",
  },
};
export function syncPresentation(state: WizardState) {
  if (state.sync === "error")
    return {
      title: "A cópia precisa de atenção",
      detail:
        "Uma etapa falhou. Seus dados já salvos foram preservados. Use o diagnóstico abaixo para investigar.",
    };
  if (state.sync === "cancelled")
    return {
      title: "Importação cancelada",
      detail:
        "Seus dados já salvos foram preservados. Abra sua conta para solicitar uma nova sincronização.",
    };
  if (state.paused && state.sync !== "working")
    return {
      title: "Próximas sincronizações pausadas",
      detail:
        "Seu histórico foi preservado. Abra sua conta e use Retomar sincronização para reativar a agenda.",
    };
  if (
    state.sync === "completed" &&
    (state.coverage.total === 0 ||
      state.coverage.complete !== state.coverage.total)
  )
    return {
      title: "Importação com cobertura parcial",
      detail:
        "Confira os recursos indisponíveis no diagnóstico antes de usar totais financeiros.",
    };
  if (state.sync === "completed")
    return {
      title: "Importação concluída",
      detail:
        "Consulte a cobertura pelo assistente antes de usar totais financeiros.",
    };
  return {
    title: "Estamos preparando sua cópia",
    detail:
      "A primeira importação depende do tamanho do histórico. Pode fechar esta página: o trabalho continua.",
  };
}
export function supportPrompt(state: WizardState, issue?: WizardIssue) {
  // Only enums, booleans and counts: no URLs, names, credentials, identifiers or provider messages.
  return [
    "Ajude-me a configurar meu Caderninho na minha própria Cloudflare. Responda em português, uma ação por vez.",
    "Não peça senhas, tokens, secrets, extratos, screenshots de credenciais ou acesso à minha conta.",
    "Diagnóstico técnico: " +
      JSON.stringify({
        credentials: state.credentials,
        connected: state.connected,
        sync: state.sync,
        paused: state.paused,
        coverage: state.coverage,
        issue: issue ?? null,
      }),
    `Meu Pluggy deve ser o conector ${PERSONAL_CONNECTOR_ID}. As contas precisam estar conectadas em meu.pluggy.ai primeiro.`,
    "Fonte: https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use",
  ].join("\n");
}
