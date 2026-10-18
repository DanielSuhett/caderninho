import { Portal } from "#web/portal-view.tsx";
import { UiButton, UiField } from "#web/ui.tsx";

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
  return (
    <Portal>
      <p className="eyebrow">Seu Caderninho · acesso privado</p>
      <h1>Entre no seu Caderninho.</h1>
      <p>
        Esta instalação está em <code>{origin}</code>.
      </p>
      {error && (
        <p
          role="alert"
          className="notice"
        >
          {error}
        </p>
      )}
      {configured ? (
        <form
          method="post"
          action="/account/login"
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
            label="Sua senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={16}
            maxLength={256}
          />
          <UiButton>Entrar</UiButton>
        </form>
      ) : (
        <p>
          Configure ADMIN_PASSWORD nos secrets deste Worker na sua conta
          Cloudflare para habilitar o acesso.
        </p>
      )}
      <details>
        <summary>Esqueci minha senha</summary>
        <p>
          Na sua Cloudflare, abra este Worker em Settings → Variables and
          Secrets e substitua ADMIN_PASSWORD por uma senha de 16 a 256
          caracteres. Publique a alteração e entre novamente. Seus dados
          financeiros são preservados.
        </p>
      </details>
    </Portal>
  );
}
