import { Portal } from "./portal-view";
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
  return (
    <Portal>
      <p className="eyebrow">Seu Caderninho · acesso privado</p>
      <h1>Entre no seu Caderninho.</h1>
      <p>
        Esta instalação está em <code>{origin}</code>.
      </p>
      {!!error && (
        <p
          className="notice"
          role="alert"
        >
          {error}
        </p>
      )}
      {configured ? (
        <form
          action="/account/login"
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
            autoComplete="current-password"
            label="Sua senha"
            maxLength={256}
            minLength={16}
            name="password"
            required
            type="password"
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
