import type {
  AccountPanel,
  AccountSyncOutcome,
  WizardIssue,
} from "../../contracts";

export const WIZARD_ISSUES: Record<
  WizardIssue,
  { title: string; action: string }
> = {
  connector: {
    action:
      "Use a opção Meu Pluggy para importar suas conexões pessoais. Não escolha o banco diretamente no widget.",
    title: "Esta conexão não veio do Meu Pluggy.",
  },
  credentials: {
    action:
      "Confira PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets deste Worker na sua Cloudflare.",
    title: "A Pluggy não reconheceu essas chaves.",
  },
  item: {
    action:
      "Abra o Meu Pluggy novamente. Se o banco não aparecer, conecte-o primeiro em meu.pluggy.ai.",
    title: "Não foi possível confirmar essa conexão.",
  },
  rate: {
    action:
      "Aguarde alguns minutos antes de tentar novamente. Não é necessário cadastrar tudo outra vez.",
    title: "A Pluggy pediu uma pausa.",
  },
  session: {
    action:
      "Entre novamente nesta instalação. Suas etapas salvas continuam aqui.",
    title: "Sua sessão precisa ser renovada.",
  },
  unavailable: {
    action:
      "Confira sua conexão e tente novamente. As etapas salvas continuam aqui.",
    title: "Não conseguimos conversar com a Pluggy agora.",
  },
  unknown: {
    action:
      "Tente novamente ou copie o diagnóstico seguro para pedir ajuda à sua IA.",
    title: "A etapa não pôde ser concluída.",
  },
};
export const SYNC_PRESENTATION: Record<
  AccountSyncOutcome,
  { title: string; detail: string }
> = {
  cancelled: {
    detail:
      "Seus dados já salvos foram preservados. Abra sua conta para solicitar uma nova sincronização.",
    title: "Importação cancelada",
  },
  complete: {
    detail:
      "Consulte a cobertura pelo assistente antes de usar totais financeiros.",
    title: "Importação concluída",
  },
  failed: {
    detail:
      "Uma etapa falhou. Seus dados já salvos foram preservados. Use o diagnóstico abaixo para investigar.",
    title: "A cópia precisa de atenção",
  },
  partial: {
    detail:
      "Confira os recursos indisponíveis no diagnóstico antes de usar totais financeiros.",
    title: "Importação com cobertura parcial",
  },
  paused: {
    detail:
      "Seu histórico foi preservado. Abra sua conta e use Retomar sincronização para reativar a agenda.",
    title: "Próximas sincronizações pausadas",
  },
  preparing: {
    detail:
      "A primeira importação depende do tamanho do histórico. Pode fechar esta página: o trabalho continua.",
    title: "Estamos preparando sua cópia",
  },
};

export function supportPrompt(support: AccountPanel["support"]) {
  return [
    "Ajude-me a configurar meu Caderninho na minha própria Cloudflare. Responda em português, uma ação por vez.",
    "Não peça senhas, tokens, secrets, extratos, screenshots de credenciais ou acesso à minha conta.",
    `Diagnóstico técnico: ${JSON.stringify(support.diagnostic)}`,
    `Meu Pluggy deve ser o conector ${support.connectorId}. As contas precisam estar conectadas em meu.pluggy.ai primeiro.`,
    "Fonte: https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use",
  ].join("\n");
}
