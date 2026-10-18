import type { ConsentDetails } from "./consent.types";
import { Portal } from "./portal-view";
import { UiButton } from "./ui";

export function Consent({
  details,
  handle,
}: {
  details: ConsentDetails;
  handle: string;
}) {
  return (
    <>
      <h1>Autorizar {details.clientName}?</h1>
      <p>
        Cliente: {details.clientDomain ?? "nome não verificado"}. Destino:{" "}
        {details.redirectHost}.
      </p>
      {details.redirectIsLoopback ? (
        <p>O destino é um aplicativo neste computador.</p>
      ) : null}
      <p>
        O assistente poderá consultar seus dados financeiros, solicitar
        sincronizações e alterar regras e correções locais. Os resultados
        consultados serão enviados ao serviço autorizado.
      </p>
      <form method="post">
        <input
          name="handle"
          type="hidden"
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

export function consentPage(details: ConsentDetails, handle: string) {
  return (
    <Portal>
      <Consent
        details={details}
        handle={handle}
      />
    </Portal>
  );
}
