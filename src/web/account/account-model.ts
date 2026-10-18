import {
  type WizardIssue,
  type WizardState,
  WizardSyncState,
} from "#contracts/wizard.types.ts";
import { PERSONAL_CONNECTOR_ID } from "#domain/connection-policy.ts";

import { type AccountState, LoadStatus } from "./account.types.ts";

export function pollingDelay({ snapshot, load }: AccountState) {
  if (load.kind === LoadStatus.failed && load.session) {
    return undefined;
  }
  if (!snapshot?.status.connected || snapshot.status.paused) {
    return undefined;
  }
  if (
    snapshot.status.sync !== WizardSyncState.waiting &&
    snapshot.status.sync !== WizardSyncState.working
  ) {
    return undefined;
  }
  return load.kind === LoadStatus.failed ? 30000 : 5000;
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
  if (state.sync === WizardSyncState.error) {
    return {
      title: "A cópia precisa de atenção",
      detail:
        "Uma etapa falhou. Seus dados já salvos foram preservados. Use o diagnóstico abaixo para investigar.",
    };
  }
  if (state.sync === WizardSyncState.cancelled) {
    return {
      title: "Importação cancelada",
      detail:
        "Seus dados já salvos foram preservados. Abra sua conta para solicitar uma nova sincronização.",
    };
  }
  if (state.paused && state.sync !== WizardSyncState.working) {
    return {
      title: "Próximas sincronizações pausadas",
      detail:
        "Seu histórico foi preservado. Abra sua conta e use Retomar sincronização para reativar a agenda.",
    };
  }
  if (
    state.sync === WizardSyncState.completed &&
    (!state.coverage.total || state.coverage.complete !== state.coverage.total)
  ) {
    return {
      title: "Importação com cobertura parcial",
      detail:
        "Confira os recursos indisponíveis no diagnóstico antes de usar totais financeiros.",
    };
  }
  if (state.sync === WizardSyncState.completed) {
    return {
      title: "Importação concluída",
      detail:
        "Consulte a cobertura pelo assistente antes de usar totais financeiros.",
    };
  }
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
