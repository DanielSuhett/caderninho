import { Banner } from "@cloudflare/kumo/components/banner";
import { useCallback } from "react";

import { UiButton } from "../ui";
import type { AccountAppearance } from "./account-identity";
import { InstallmentTable } from "./installment-table";
import { useTransactionReader } from "./transaction-reader";
import { useResource } from "./workspace-resource";

export function RelatedInstallments({
  id,
  accountId,
  account,
}: {
  id: string;
  accountId: string;
  account: AccountAppearance;
}) {
  const read = useTransactionReader();
  return read ? (
    <LoadedInstallments
      account={account}
      accountId={accountId}
      id={id}
      read={read}
    />
  ) : null;
}
function LoadedInstallments({
  id,
  accountId,
  account,
  read,
}: {
  id: string;
  accountId: string;
  account: AccountAppearance;
  read: NonNullable<ReturnType<typeof useTransactionReader>>;
}) {
  const load = useCallback(
    (signal: AbortSignal, fresh: boolean) => read(id, accountId, signal, fresh),
    [accountId, id, read],
  );
  const resource = useResource(load);
  const { data } = resource;
  const purchase = data?.data.records[0];
  if (resource.error) {
    return (
      <Banner
        description={
          <div className="installment-recovery">
            <p>Não foi possível carregar as parcelas.</p>
            <UiButton
              onClick={resource.retry}
              variant="secondary"
            >
              Tentar novamente
            </UiButton>
          </div>
        }
        variant="error"
      />
    );
  }
  if (!data) {
    return (
      <p
        className="muted"
        role="status"
      >
        Carregando parcelas…
      </p>
    );
  }
  if (!purchase?.installments.length) {
    return (
      <p className="muted">
        Não foi possível vincular outras parcelas com segurança.
      </p>
    );
  }
  return (
    <>
      {data.partial === true && (
        <Banner
          description="Importação parcial. Esta lista pode estar incompleta."
          variant="secondary"
        />
      )}
      <InstallmentTable
        account={account}
        installments={purchase.installments}
        referenceDay={data.data.referenceDay}
        total={purchase.totalInstallments}
      />
    </>
  );
}
