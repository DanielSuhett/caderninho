import { Portal } from "#web/portal-view.tsx";
import { UiButton, UiField, UiLink } from "#web/ui.tsx";

export function accessPage(
  origin: string,
  admin: boolean,
  github: boolean,
  csrf: string,
  error = "",
  target = "/account",
) {
  return (
    <Portal>
      <p className="eyebrow">Sua instância · acesso privado</p>
      <h1>Abra seu Caderninho.</h1>
      <p>
        Você está entrando em <code>{origin}</code>. As credenciais e os dados
        ficam nesta instalação.
      </p>
      {error && (
        <p
          role="alert"
          className="notice"
        >
          {error}
        </p>
      )}
      {admin && (
        <form
          method="post"
          action="/account/access"
        >
          <input
            type="hidden"
            name="csrf"
            value={csrf}
          />
          <input
            type="hidden"
            name="returnTo"
            value={target}
          />
          <UiField
            label="Chave administrativa"
            name="key"
            type="password"
            autoComplete="current-password"
            required
            minLength={64}
            maxLength={64}
          />
          <p>
            <small>
              Use a chave guardada durante a instalação. Ela não é o Client
              Secret da Pluggy nem um token para o assistente.
            </small>
          </p>
          <UiButton>Entrar na minha instância</UiButton>
        </form>
      )}
      {github && (
        <UiLink
          href={
            "/account/login?method=github&returnTo=" +
            encodeURIComponent(target)
          }
          variant="secondary"
        >
          Entrar com GitHub
        </UiLink>
      )}
      {!admin && !github && (
        <>
          <p>
            A entrada ainda precisa ser configurada por quem administra esta
            instalação.
          </p>
          <UiLink href="https://github.com/DanielSuhett/caderninho#instale-na-sua-cloudflare">
            Abrir guia de instalação
          </UiLink>
        </>
      )}
      <details>
        <summary>Perdi minha chave</summary>
        <p>
          Na conta Cloudflare que hospeda esta instância, substitua
          ADMIN_KEY_SHA256 pelo verificador de uma nova chave. As sessões
          abertas com a chave antiga expiram. Preserve OWNER_ID ou
          OWNER_GITHUB_ID e CREDENTIAL_KEY: eles mantêm o vínculo e o acesso aos
          seus dados.
        </p>
        <a href="https://github.com/DanielSuhett/caderninho#recuperar-acesso">
          Ver instruções de recuperação
        </a>
      </details>
    </Portal>
  );
}
