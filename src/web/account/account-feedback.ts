import type { AccountFailureCode } from "../../contracts";
import { HttpRequestError } from "../../shared";

export class AccountRequestError extends Error {
  readonly code: AccountFailureCode;

  constructor(code: AccountFailureCode) {
    super(code);
    this.code = code;
  }
}

export type ManagementOutcome =
  | { ok: true; id?: string; personId?: string }
  | { ok: false; message: string };

export function accountFailureMessage(error: Error) {
  if (error instanceof AccountRequestError) {
    const messages: Record<AccountFailureCode, string> = {
      APPLICATION_CHANGE_REQUIRES_NEW_PROFILE:
        "Este acesso já está vinculado a outra aplicação. Use o Client ID original para atualizar o segredo.",
      CREDENTIALS_REQUIRED: "Informe o Client ID e o Client Secret juntos.",
      NOT_FOUND:
        "Esta pessoa ou conta Pluggy não está mais disponível. Atualize a página.",
      PROFILE_DISABLED:
        "Esta conta Pluggy está pausada. Reative-a nas configurações para conectar.",
      PROFILE_EXISTS:
        "Este Client ID já está cadastrado. Volte a Pessoas e use o cadastro existente para adicionar bancos.",
      PROFILE_OWNER_IMMUTABLE:
        "A conta Pluggy já pertence a outro titular. Adicione outra conta para esta pessoa.",
      SOURCE_IDENTITY_MISMATCH:
        "A conexão não pertence à conta Pluggy selecionada. Confira a conta antes de continuar.",
      UPSTREAM_AUTH:
        "A Pluggy recusou as credenciais. Confira o Client ID e o Client Secret da mesma aplicação e tente novamente.",
      UPSTREAM_FORBIDDEN:
        "A Pluggy não permitiu esta operação. Confira as permissões da sua aplicação Pluggy.",
      UPSTREAM_RATE_LIMIT:
        "A Pluggy limitou as tentativas. Aguarde um minuto antes de tentar novamente.",
      UPSTREAM_TIMEOUT:
        "A Pluggy demorou a responder. Seus campos foram mantidos; tente novamente.",
      UPSTREAM_UNAVAILABLE:
        "A Pluggy está indisponível. Seus campos foram mantidos; tente novamente mais tarde.",
    };
    return messages[error.code];
  }
  if (
    error instanceof HttpRequestError &&
    ["unauthorized", "forbidden", "redirect"].includes(error.failure.kind)
  ) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  return "Não foi possível confirmar a alteração. Confira as contas cadastradas antes de repetir; uma resposta perdida pode ter sido salva.";
}
