import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";

import { PublicLayout } from "./public-layout";
import { UiButton } from "./ui";

export function accessPage({
  origin,
  configured,
  generated = false,
  csrf,
  error = "",
  target = "/account",
}: {
  origin: string;
  configured: boolean;
  generated?: boolean;
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
  if (generated) {
    intro =
      "Use a chave da sua instalação para entrar e autorizar seus assistentes.";
  }
  if (authorizing) {
    heading = "Continue a autorização";
    intro =
      "Entre para revisar a solicitação do seu assistente. A autorização será confirmada na próxima tela.";
  }
  if (!configured) {
    heading = "Conclua o acesso desta instalação";
    intro =
      "A instalação ainda não concluiu a geração do acesso. Reabra o resultado do deploy na sua Cloudflare.";
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
              <div
                data-csrf={csrf}
                data-target={target}
                id="generated-access"
              >
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
                  <Input
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={
                      error === "Senha inválida." || error === "Chave inválida."
                        ? true
                        : undefined
                    }
                    autoComplete="current-password"
                    label={generated ? "Chave de acesso" : "Sua senha"}
                    maxLength={256}
                    minLength={16}
                    name="password"
                    required
                    type="password"
                  />
                  <UiButton
                    size="lg"
                    variant="primary"
                  >
                    {authorizing ? "Entrar e continuar" : "Entrar"}
                  </UiButton>
                </form>
              </div>
              <details>
                <summary>
                  {generated ? "Perdi minha chave" : "Esqueci minha senha"}
                </summary>
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
              Na Cloudflare, confira o último deploy. O resultado entrega um
              link privado para copiar sua chave e começar. Depois,{" "}
              <a href={reopen}>reabra esta página</a>.
            </p>
          )}
        </LayerCard>
        <p className="access-help">
          {authorizing
            ? "Entrar não concede acesso automaticamente."
            : "Este acesso pertence à sua instalação, não à sua conta bancária."}
        </p>
      </main>
      {!!(configured && generated) && (
        <script
          src="/access.js"
          type="module"
        />
      )}
    </PublicLayout>
  );
}
