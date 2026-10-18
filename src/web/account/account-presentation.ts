import type {
  AccountPanel,
  AccountSyncOutcome,
} from "@/contracts/portal.types";
import type { WizardIssue } from "@/contracts/wizard.types";

export const WIZARD_ISSUES: Record<
  WizardIssue,
  { title: string; action: string }
> = {
  credentials: {
    title: "A Pluggy não reconheceu essas chaves.",
    action:
      "Confira PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets deste Worker na sua Cloudflare.",
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
export const SYNC_PRESENTATION: Record<
  AccountSyncOutcome,
  { title: string; detail: string }
> = {
  failed: {
    title: "A cópia precisa de atenção",
    detail:
      "Uma etapa falhou. Seus dados já salvos foram preservados. Use o diagnóstico abaixo para investigar.",
  },
  cancelled: {
    title: "Importação cancelada",
    detail:
      "Seus dados já salvos foram preservados. Abra sua conta para solicitar uma nova sincronização.",
  },
  paused: {
    title: "Próximas sincronizações pausadas",
    detail:
      "Seu histórico foi preservado. Abra sua conta e use Retomar sincronização para reativar a agenda.",
  },
  partial: {
    title: "Importação com cobertura parcial",
    detail:
      "Confira os recursos indisponíveis no diagnóstico antes de usar totais financeiros.",
  },
  complete: {
    title: "Importação concluída",
    detail:
      "Consulte a cobertura pelo assistente antes de usar totais financeiros.",
  },
  preparing: {
    title: "Estamos preparando sua cópia",
    detail:
      "A primeira importação depende do tamanho do histórico. Pode fechar esta página: o trabalho continua.",
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
