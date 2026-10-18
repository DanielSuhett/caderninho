import { z } from "zod/v4";

import { Portal } from "#web/portal-view.tsx";
import { UiButton } from "#web/ui.tsx";

export const ConsentDetailsSchema = z.object({
  clientName: z.string(),
  clientDomain: z.string().nullish(),
  redirectHost: z.string(),
  redirectIsLoopback: z.boolean(),
  scope: z.array(z.string()),
});

export function Consent({
  details,
  handle,
}: {
  details: z.infer<typeof ConsentDetailsSchema>;
  handle: string;
}) {
  return (
    <>
      <h1>Autorizar {details.clientName}?</h1>
      <p>
        Cliente: {details.clientDomain ?? "nome não verificado"}. Destino:{" "}
        {details.redirectHost}.
      </p>
      {details.redirectIsLoopback && (
        <p>O destino é um aplicativo neste computador.</p>
      )}
      <p>
        Acesso solicitado: {details.scope.join(", ")}. Permite consultar dados
        financeiros, solicitar sincronizações e alterar regras e correções
        locais. Os resultados consultados serão enviados ao serviço autorizado.
      </p>
      <form method="post">
        <input
          type="hidden"
          name="handle"
          value={handle}
        />
        <UiButton
          name="decision"
          value="approve"
        >
          Autorizar
        </UiButton>
        <UiButton
          name="decision"
          value="deny"
          variant="secondary"
        >
          Negar
        </UiButton>
      </form>
    </>
  );
}

export function consentPage(
  details: z.infer<typeof ConsentDetailsSchema>,
  handle: string,
) {
  return (
    <Portal>
      <Consent
        details={details}
        handle={handle}
      />
    </Portal>
  );
}
