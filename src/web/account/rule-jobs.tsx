import { Banner } from "@cloudflare/kumo/components/banner";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RuleJob } from "../../contracts";
import {
  RuleJobKind,
  RuleJobPhase,
  RuleJobStatus,
  ruleJobActive,
} from "../../domain";
import { HttpRequestError, tryCatch } from "../../shared";
import type { OrganizationApi } from "./account-api";

const count = new Intl.NumberFormat("pt-BR");
const POLL_MS = 1500;

function plural(value: number, one: string, many: string) {
  return `${count.format(value)} ${value === 1 ? one : many}`;
}

export function ruleJobSummary(job: RuleJob) {
  const changed = plural(
    job.applied.changed,
    "transação recategorizada",
    "transações recategorizadas",
  );
  if (job.kind === RuleJobKind.reapply) {
    return `Regras reaplicadas: ${changed}.`;
  }
  const { rulesCreated, rulesExisting, skippedTotal } = job.imported;
  const parts = [
    plural(rulesCreated, "regra nova", "regras novas"),
    rulesExisting && plural(rulesExisting, "já existia", "já existiam"),
    skippedTotal && plural(skippedTotal, "ignorada", "ignoradas"),
  ].filter(Boolean);
  return `${parts.join(", ")}. ${changed}.`;
}

function progress(job: RuleJob) {
  if (job.status === RuleJobStatus.queued) {
    return "Na fila para começar…";
  }
  if (job.phase === RuleJobPhase.import) {
    return `Importando regras: lote ${count.format(
      Math.min(job.imported.chunks + 1, job.chunks),
    )} de ${count.format(job.chunks)}.`;
  }
  return `Reaplicando ao histórico: ${plural(
    job.applied.changed,
    "transação recategorizada",
    "transações recategorizadas",
  )} até agora.`;
}

// Jobs run in the Worker; the page only follows the stored state while one is
// active and stops polling as soon as it settles.
export function useRuleJob({
  api,
  csrf,
  spaceId,
  settled,
}: {
  api: OrganizationApi;
  csrf: string;
  spaceId: string;
  settled: (job: RuleJob) => void;
}) {
  const [job, setJob] = useState<RuleJob | null>(null);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const notify = useRef(settled);
  notify.current = settled;
  useEffect(() => {
    const controller = new AbortController();
    tryCatch(() => api.ruleJob({ spaceId }, controller.signal)).then(
      ({ data, error }) => {
        if (!(error || controller.signal.aborted)) {
          setJob(data);
        }
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [api, spaceId]);
  const active = ruleJobActive(job);
  // A hidden tab stops following the job and reconciles when it returns.
  const [visible, setVisible] = useState(
    () => document.visibilityState === "visible",
  );
  useEffect(() => {
    const change = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (!(visible && job && ruleJobActive(job))) {
      return;
    }
    const { id } = job;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const { data, error } = await tryCatch(() =>
        api.ruleJob({ id }, controller.signal),
      );
      if (controller.signal.aborted) {
        return;
      }
      if (error || !data) {
        // Transient read failures keep following the same job.
        setJob((previous) => previous && { ...previous });
        return;
      }
      setJob(data);
      if (!ruleJobActive(data)) {
        notify.current(data);
      }
    }, POLL_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, job, visible]);
  const started = useCallback((next: RuleJob) => {
    setMessage("");
    setJob(next);
    if (!ruleJobActive(next)) {
      notify.current(next);
    }
  }, []);
  const reapply = useCallback(async () => {
    setMessage("");
    setStarting(true);
    const { data, error } = await tryCatch(() =>
      api.ruleJobs(
        { action: "reapply", csrf, spaceId },
        new AbortController().signal,
      ),
    );
    setStarting(false);
    if (error) {
      setMessage(
        error instanceof HttpRequestError && error.failure.status === 409
          ? "Já existe uma atualização de regras em andamento."
          : "Não foi possível reaplicar as regras. Tente novamente.",
      );
      return;
    }
    started(data);
  }, [api, csrf, spaceId, started]);
  return { active, job, message, reapply, started, starting };
}

export function RuleJobNotice({
  job,
  message,
}: {
  job: RuleJob | null;
  message: string;
}) {
  if (message) {
    return (
      <Banner
        description={message}
        title="Regras"
        variant="error"
      />
    );
  }
  if (!job) {
    return null;
  }
  if (ruleJobActive(job)) {
    return (
      <p
        className="muted"
        role="status"
      >
        {progress(job)}
      </p>
    );
  }
  if (job.status === RuleJobStatus.failed) {
    return (
      <Banner
        description="As regras já gravadas foram mantidas. Tente novamente; os lotes concluídos não serão repetidos."
        title="A atualização de regras não terminou"
        variant="error"
      />
    );
  }
  if (job.kind !== RuleJobKind.import || !job.imported.skippedTotal) {
    return null;
  }
  return (
    <Banner
      className="feedback"
      description={
        <details className="rule-job-skipped">
          <summary>Ver motivos</summary>
          <ul>
            {job.imported.skipped.map((row) => (
              <li key={`${row.key}:${row.reason}`}>
                <strong>{row.key}</strong>: {row.reason}
              </li>
            ))}
          </ul>
          {job.imported.skippedTotal > job.imported.skipped.length && (
            <p>
              Mostrando as primeiras {count.format(job.imported.skipped.length)}
              .
            </p>
          )}
        </details>
      }
      title={plural(
        job.imported.skippedTotal,
        "regra ignorada na última importação",
        "regras ignoradas na última importação",
      )}
      variant="alert"
    />
  );
}
