import { useCallback, useEffect, useState } from "react";

import type { RulePreviewInput, RulePreviewResult } from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";

export function RulePreview({
  api,
  input,
  accounts,
}: {
  api: OrganizationApi;
  input: RulePreviewInput | null;
  accounts: { id: string; name: string }[];
}) {
  const [attempt, setAttempt] = useState(0);
  const key = input ? JSON.stringify({ attempt, input }) : "";
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const [state, setState] = useState<{
    key: string;
    data?: RulePreviewResult;
    error?: boolean;
  }>({ key: "" });
  useEffect(() => {
    if (!input) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const { data: loaded, error } = await tryCatch(() =>
        api.previewRule(input, controller.signal),
      );
      if (controller.signal.aborted) {
        return;
      }
      setState(error ? { error: true, key } : { data: loaded, key });
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, input, key]);
  const current = key === state.key;
  const data = current ? state.data : undefined;
  let status = "Complete as condições para consultar.";
  if (input && !current) {
    status = "Conferindo transações…";
  }
  if (input && current && state.error) {
    status = "Não foi possível consultar. Seu rascunho está preservado.";
  }
  if (data) {
    const matches =
      data.count === 1 ? "transação corresponde" : "transações correspondem";
    status = `${data.truncated ? "Pelo menos " : ""}${data.count} ${matches}`;
  }
  return (
    <section
      aria-busy={!!key && !current}
      aria-label="Prévia das condições"
      className="rule-preview"
    >
      <h3>Prévia das condições</h3>
      <p
        aria-live="polite"
        role="status"
      >
        {status}
      </p>
      {current && !!state.error && (
        <UiButton
          onClick={retry}
          type="button"
          variant="secondary"
        >
          Tentar novamente
        </UiButton>
      )}
      {!!data && (
        <>
          <p className="muted">
            {data.examined.toLocaleString("pt-BR")} registros examinados.{" "}
            {data.truncated
              ? "Limite de 10 mil atingido: esta contagem é parcial."
              : "Consulta concluída."}{" "}
            {!!data.partial && "Há conexões com dados parciais."}
          </p>
          <ul className="preview-samples">
            {data.samples.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{row.description}</strong>
                  <small>
                    {accounts.find((account) => account.id === row.accountId)
                      ?.name ?? "Conta não identificada"}{" "}
                    · {row.personName} ·{" "}
                    {row.date.split("-").reverse().join("/")}
                  </small>
                </span>
                <span>{formatBalance(row.amountMinor, row.currency)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted">
        Prévia somente leitura; outra regra pode ter prioridade.
      </p>
    </section>
  );
}
