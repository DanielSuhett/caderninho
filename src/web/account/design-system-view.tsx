import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Field } from "@cloudflare/kumo/components/field";
import { Grid } from "@cloudflare/kumo/components/grid";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { useCallback, useState } from "react";

import { UiButton } from "../ui";
import { BackofficeDialog } from "./backoffice-dialog";
import { DesignPalette } from "./design-palette";
import { TransactionList } from "./transaction-list";
import { EmptyView } from "./workspace-filters";
import {
  WorkspaceDetails,
  WorkspaceHeading,
  WorkspaceSkeleton,
} from "./workspace-ui";

const sampleInstallment = {
  accountId: "demo-card",
  amountMinor: "-39066",
  cardNumber: "1234",
  category: "Viagem",
  currency: "BRL",
  date: "2026-10-01",
  description: "Hospedagem · exemplo",
  direction: "DEBIT" as const,
  id: "demo-installment-1",
  ignored: false,
  installmentNumber: 1,
  manual: false,
  personId: "demo-ana",
  personName: "Ana (exemplo)",
  purchaseDate: "2026-10-01",
  status: "POSTED" as const,
  totalInstallments: 3,
};
const samplePurchase = {
  ...sampleInstallment,
  anchorDate: "2026-10-01",
  anchorKind: "purchase" as const,
  installments: [
    sampleInstallment,
    {
      ...sampleInstallment,
      date: "2026-11-01",
      id: "demo-installment-2",
      installmentNumber: 2,
      status: "PENDING" as const,
    },
    {
      ...sampleInstallment,
      date: "2026-12-01",
      id: "demo-installment-3",
      installmentNumber: 3,
      status: "PENDING" as const,
    },
  ],
};

export function DesignSystemView() {
  const [confirm, setConfirm] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const { add } = useKumoToastManager();
  const ask = useCallback(() => setConfirm(true), []);
  const cancel = useCallback(() => setConfirm(false), []);
  const confirmed = useCallback(() => {
    setConfirm(false);
    add({
      title: "Confirmação demonstrada. Nenhum acesso foi revogado.",
      variant: "success",
    });
  }, [add]);
  return (
    <div className="design-system">
      <WorkspaceHeading
        description="Componentes reais do Kumo 2.14.0 com dados fictícios."
        title="Referência visual"
      />
      <Banner
        description="Exemplos de desenvolvimento. Nenhum dado financeiro é alterado."
        variant="secondary"
      />
      <WorkspaceDetails
        defaultOpen
        title="Fundação e tokens"
      >
        <DesignPalette />
      </WorkspaceDetails>
      <WorkspaceDetails
        defaultOpen
        title="Controles e formulários"
      >
        <LayerCard className="gallery-surface">
          <Grid
            gap="sm"
            variant="2up"
          >
            <Input
              label="Nome"
              placeholder="Nome do grupo"
            />
            <Select
              defaultValue="BRL"
              items={{ BRL: "Real brasileiro", USD: "Dólar americano" }}
              label="Moeda"
            />
            <Field
              description="Um rótulo não substitui a identidade do registro."
              label="Apelido (opcional)"
            >
              <Input
                aria-label="Apelido (opcional)"
                placeholder="Ex.: Conta da casa"
              />
            </Field>
            <Input
              error="Confira este valor."
              label="Campo com erro"
              readOnly
              value="Exemplo inválido"
            />
          </Grid>
          <div className="design-actions">
            <UiButton
              onClick={ask}
              type="button"
            >
              Abrir confirmação
            </UiButton>
            <UiButton
              disabled
              type="button"
              variant="secondary"
            >
              Indisponível
            </UiButton>
            <Switch
              checked={enabled}
              label="Regra ativa no rascunho"
              onCheckedChange={setEnabled}
            />
          </div>
          <Label asContent>
            As alterações são aplicadas somente ao salvar.
          </Label>
        </LayerCard>
      </WorkspaceDetails>
      <WorkspaceDetails
        defaultOpen
        title="Feedback e estados"
      >
        <div className="design-feedback">
          <Banner
            description="Os dados já publicados continuam consultáveis."
            title="Importação interrompida"
            variant="error"
          />
          <Banner
            description="A importação ainda não foi concluída."
            title="Histórico parcial"
            variant="alert"
          />
          <div className="design-actions">
            <Badge variant="success">Concluída</Badge>
            <Badge variant="warning">Pendente</Badge>
            <Badge variant="info">Futura</Badge>
            <Badge variant="secondary">Ignorada</Badge>
          </div>
          <Meter
            customValue="35 de 100 registros"
            label="Consumo de exemplo"
            value={35}
          />
          <EmptyView title="Nenhuma transação neste recorte">
            Altere os filtros para consultar outros dados.
          </EmptyView>
          <WorkspaceSkeleton />
        </div>
      </WorkspaceDetails>
      <WorkspaceDetails
        defaultOpen
        title="Transação e parcelas"
      >
        <TransactionList
          accounts={[{ id: "demo-card", name: "Cartão · exemplo" }]}
          categories={[{ id: "Viagem", name: "Viagem" }]}
          records={[samplePurchase]}
          referenceDay="2026-10-24"
        />
      </WorkspaceDetails>
      <BackofficeDialog
        busy={false}
        close={cancel}
        dirty={false}
        open={confirm}
        presentation="confirmation"
        primaryAction={{
          children: "Confirmar exemplo",
          onClick: confirmed,
          type: "button",
          variant: "destructive",
        }}
        title="Exemplo de confirmação"
      >
        <p>Esta demonstração não revoga autorizações nem altera dados.</p>
      </BackofficeDialog>
    </div>
  );
}
