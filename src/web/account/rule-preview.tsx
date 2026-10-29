import { useCallback, useEffect, useRef, useState } from "react";

import type { RulePreviewInput, RulePreviewResult } from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";

export function RulePreview({
  api,
  input,
  accounts,
  loaded: reportLoaded,
}: {
  api: OrganizationApi;
  input: RulePreviewInput | null;
  accounts: { id: string; name: string }[];
  loaded?: (result: RulePreviewResult) => void;
}) {
  const report = useRef(reportLoaded);
  report.current = reportLoaded;
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
      if (!error) {
        report.current?.(loaded);
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
  let status = "Complete as condições para ver o que a regra encontra.";
  if (input && !current) {
    status = "Procurando transações…";
  }
  if (input && current && state.error) {
    status = "Não foi possível consultar. Seu rascunho está preservado.";
  }
  if (data) {
    status = previewStatus(data);
  }
  return (
    <section
      aria-busy={!!key && !current}
      aria-label="Transações encontradas"
      className="rule-preview"
    >
      <p
        aria-live="polite"
        className="rule-preview-status"
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
      {!!data?.samples.length && (
        <ul className="preview-samples">
          {data.samples.map((row) => (
            <li key={row.id}>
              <span>
                <strong>{row.counterparty ?? row.description}</strong>
                <small>
                  {[
                    row.counterparty && row.description,
                    accounts.find((account) => account.id === row.accountId)
                      ?.name ?? "Conta não identificada",
                    row.date.split("-").reverse().join("/"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
              <span>{formatBalance(row.amountMinor, row.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const count = new Intl.NumberFormat("pt-BR");
function previewStatus(data: RulePreviewResult) {
  if (!data.count) {
    return "Nenhuma transação encontrada. A regra vale para as próximas importações.";
  }
  const matches =
    data.count === 1 ? "transação encontrada" : "transações encontradas";
  const prefix = data.truncated ? "Pelo menos " : "";
  const partial = data.partial ? " Algumas conexões têm dados parciais." : "";
  return `${prefix}${count.format(data.count)} ${matches}.${partial}`;
}
