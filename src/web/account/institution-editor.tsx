import { Banner } from "@cloudflare/kumo/components/banner";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ConnectionInfo, HouseholdCommand } from "../../contracts";
import type { Institution } from "../../domain";
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import type { ManagementOutcome } from "./account-feedback";
import { BackofficeDialog } from "./backoffice-dialog";

function institutionName(row: Institution) {
  return row.name;
}
function institutionId(row: Institution) {
  return row.id;
}
function renderInstitution(row: Institution) {
  return (
    <Combobox.Item
      key={row.id}
      value={row}
    >
      {row.name}
    </Combobox.Item>
  );
}

export function InstitutionEditor({
  connection,
  csrf,
  manage,
  close,
  institution,
  institutions: loadInstitutions,
}: {
  connection: ConnectionInfo;
  csrf: string;
  institutions: ReturnType<typeof createAccountApi>["institutions"];
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
  close: () => void;
  institution: Institution | null;
}) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState(institution?.id ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(
    () => ({ attempt, profileId: connection.profileId ?? "default" }),
    [connection.profileId, attempt],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMessage("");
    async function load() {
      const { data, error } = await tryCatch(() =>
        loadInstitutions(request.profileId, controller.signal),
      );
      if (controller.signal.aborted) {
        return;
      }
      setLoading(false);
      if (error) {
        setMessage(
          "Não foi possível carregar os bancos da Pluggy. Tente novamente.",
        );
        return;
      }
      setInstitutions(data.records);
    }
    load().then(
      () => undefined,
      () => undefined,
    );
    return () => controller.abort();
  }, [loadInstitutions, request]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const choose = useCallback(
    (value: Institution | null) => setSelected(value?.id ?? ""),
    [],
  );
  const save = useCallback(async () => {
    if (selected && !institutions.some((row) => row.id === selected)) {
      return;
    }
    setBusy(true);
    const { data, error } = await tryCatch(() =>
      manage({
        action: "set_connection_institution",
        connectionId: connection.id,
        csrf,
        institutionId: selected || null,
      }),
    );
    setBusy(false);
    if (error) {
      setMessage(
        "Não foi possível confirmar a alteração. Confira o banco antes de tentar novamente.",
      );
      return;
    }
    if (!data.ok) {
      setMessage(data.message);
      return;
    }
    close();
  }, [close, connection.id, csrf, institutions, manage, selected]);
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={false}
      open
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar banco",
        disabled:
          loading ||
          (!!selected && !institutions.some((row) => row.id === selected)),
        onClick: save,
      }}
      title="Corrigir banco"
    >
      <div className="backoffice-form">
        <p>
          O banco é identificado pelos dados da Pluggy a cada importação.
          Corrija somente se estiver errado; a escolha vale para as contas,
          cartões e investimentos vinculados.
        </p>
        <ul>
          {Object.entries(connection.accounts).map(([id, account]) => (
            <li key={id}>{account.name}</li>
          ))}
        </ul>
        <Combobox
          disabled={busy || loading}
          items={institutions}
          itemToStringLabel={institutionName}
          itemToStringValue={institutionId}
          label="Banco"
          onValueChange={choose}
          value={
            institutions.find((row) => row.id === selected) ??
            (selected === institution?.id ? institution : null)
          }
        >
          <Combobox.TriggerInput
            clearLabel="Remover identificação"
            placeholder="Busque o banco"
            showOptionsLabel="Mostrar bancos"
          />
          <Combobox.Content>
            <Combobox.Empty>Nenhum banco encontrado.</Combobox.Empty>
            <Combobox.List>{renderInstitution}</Combobox.List>
          </Combobox.Content>
        </Combobox>
        {!!loading && <p role="status">Carregando bancos…</p>}
        {!!message && (
          <>
            <Banner
              description={message}
              title="Confira o banco"
              variant="error"
            />
            <UiButton
              onClick={retry}
              type="button"
            >
              Tentar novamente
            </UiButton>
          </>
        )}
      </div>
    </BackofficeDialog>
  );
}
