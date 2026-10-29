import { Banner } from "@cloudflare/kumo/components/banner";

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
      <h1 className="consent-title">Autorizar {details.clientName}?</h1>
      <p>
        Cliente: {details.clientDomain ?? "nome não verificado"}. Destino:{" "}
        {details.redirectHost}.
      </p>
      {details.redirectIsLoopback ? (
        <p>O destino é um aplicativo neste computador.</p>
      ) : null}
      <p>
        O assistente terá acesso aos dados de toda esta instalação. Poderá
        consultar suas finanças, solicitar importações e usar as ferramentas de
        organização para criar, alterar ou excluir registros, conforme as
        confirmações exigidas por cada ferramenta. Os resultados consultados
        serão enviados ao serviço autorizado.
      </p>
      <Banner
        className="feedback"
        description={
          <>
            Essa autorização não permite movimentar dinheiro nos bancos. Você
            pode revogar o acesso pela Observabilidade.
          </>
        }
        variant="default"
      />
      <form method="post">
        <input
          name="handle"
          type="hidden"
          value={handle}
        />
        <UiButton
          name="decision"
          size="lg"
          value="approve"
          variant="primary"
        >
          Autorizar
        </UiButton>
        <UiButton
          name="decision"
          size="lg"
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
