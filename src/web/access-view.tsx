import { Banner, LayerCard } from "@cloudflare/kumo";

import { PublicLayout } from "./public-layout";
import { UiButton, UiField } from "./ui";

export function accessPage({
  origin,
  configured,
  csrf,
  error = "",
  target = "/account",
}: {
  origin: string;
  configured: boolean;
  csrf: string;
  error?: string;
  target?: string;
}) {
  const authorizing = target.startsWith("/authorize?");
  const reopen = authorizing
    ? `/account/login?${new URLSearchParams({ returnTo: target })}`
    : "/account/login";
  let heading = "Entrar nesta instalação";
  let intro =
    "Use a senha definida na sua instalação para gerenciar conexões, dados e assistentes.";
  if (authorizing) {
    heading = "Continue a autorização";
    intro =
      "Entre para revisar a solicitação do seu assistente. A autorização será confirmada na próxima tela.";
  }
  if (!configured) {
    heading = "Conclua o acesso desta instalação";
    intro =
      "O acesso ainda não foi configurado. O proprietário precisa definir uma senha na Cloudflare.";
  }
  return (
    <PublicLayout
      access
      description="Acesso privado à sua instalação do Caderninho."
      title={`Caderninho · ${heading}`}
    >
      <main
        className="access-main"
        id="conteudo"
        tabIndex={-1}
      >
        <LayerCard className="public-surface">
          <p className="public-kicker">Seu Caderninho · acesso privado</p>
          <h1>{heading}</h1>
          <p className="access-intro">{intro}</p>
          <div className="access-origin">
            Você está acessando<code>{origin}</code>
          </div>
          {!!error && (
            <Banner
              description={error}
              id="login-error"
              role="alert"
              variant="error"
            />
          )}
          {configured ? (
            <>
              <form
                action="/account/login"
                className="access-form"
                method="post"
              >
                <input
                  name="csrf"
                  type="hidden"
                  value={csrf}
                />
                <input
                  name="returnTo"
                  type="hidden"
                  value={target}
                />
                <UiField
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={error === "Senha inválida." ? true : undefined}
                  autoComplete="current-password"
                  label="Sua senha"
                  maxLength={256}
                  minLength={16}
                  name="password"
                  required
                  type="password"
                />
                <UiButton size="lg">
                  {authorizing ? "Entrar e continuar" : "Entrar"}
                </UiButton>
              </form>
              <details>
                <summary>Esqueci minha senha</summary>
                <p>
                  Na sua Cloudflare, abra este Worker em Settings → Variables
                  and Secrets e substitua <code>ADMIN_PASSWORD</code> por uma
                  senha de 16 a 256 caracteres. Publique a alteração e entre
                  novamente. Seus dados financeiros são preservados.
                </p>
              </details>
            </>
          ) : (
            <p className="access-intro">
              Na Cloudflare, abra este Worker em Settings → Variables and
              Secrets. Defina <code>ADMIN_PASSWORD</code> com 16 a 256
              caracteres e publique a alteração. Depois,{" "}
              <a href={reopen}>reabra esta página</a>.
            </p>
          )}
        </LayerCard>
        <p className="access-help">
          {authorizing
            ? "Entrar não concede acesso automaticamente."
            : "A senha pertence a esta instalação, não à sua conta bancária."}
        </p>
      </main>
    </PublicLayout>
  );
}
