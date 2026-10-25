import { Banner } from "@cloudflare/kumo/components/banner";
import { useCallback, useEffect, useRef, useState } from "react";

import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import { DisclosureItem } from "./disclosure-item";
import { WorkspaceSkeleton } from "./workspace-ui";

export function useResource<T>(
  load: (signal: AbortSignal, fresh: boolean) => Promise<T>,
) {
  const [version, setVersion] = useState(0);
  const previousLoad = useRef(load);
  const [state, setState] = useState<{
    data: T | undefined;
    error: boolean;
    loading: boolean;
    request: number;
  }>({ data: undefined, error: false, loading: true, request: 0 });
  const retry = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const sameQuery = previousLoad.current === load;
    previousLoad.current = load;
    setState((previous) => ({
      data: sameQuery ? previous.data : undefined,
      error: false,
      loading: true,
      request: version,
    }));
    tryCatch(() => load(controller.signal, version > 0)).then(
      ({ data, error }) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error) {
          setState((previous) => ({
            data: previous.data,
            error: true,
            loading: false,
            request: version,
          }));
          return;
        }
        setState({ data, error: false, loading: false, request: version });
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [load, version]);
  return { ...state, retry };
}
export function ResourceFeedback({
  error,
  loading,
  retry,
  data,
}: {
  error: boolean;
  loading: boolean;
  retry: () => void;
  data?: unknown;
}) {
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), 150);
    return () => clearTimeout(timer);
  }, [loading]);
  const first = new URLSearchParams(location.search);
  first.delete("cursor");
  first.delete("grantCursor");
  if (loading && !data) {
    return showLoading ? <WorkspaceSkeleton /> : null;
  }
  if (loading && showLoading) {
    return (
      <p
        className="workspace-feedback"
        role="status"
      >
        Atualizando dados…
      </p>
    );
  }
  if (error) {
    return (
      <Banner
        className="feedback"
        description={
          <div className="resource-error-content">
            <p>
              {data
                ? "Não foi possível atualizar esta visão. Os dados exibidos podem estar desatualizados."
                : "Não foi possível carregar esta visão."}
            </p>
            <UiButton
              onClick={retry}
              type="button"
              variant="secondary"
            >
              Tentar novamente
            </UiButton>
            <DisclosureItem summary="Outras opções de recuperação">
              <ul className="resource-recovery-links">
                <li>
                  <a href={`${location.pathname}?${first}`}>
                    Reabrir do início
                  </a>
                </li>
                <li>
                  <a href={location.pathname}>Limpar todos os filtros</a>
                </li>
                <li>
                  <a href="/account/login">Entrar novamente</a>
                </li>
              </ul>
            </DisclosureItem>
          </div>
        }
        role="alert"
        variant="error"
      />
    );
  }
  return null;
}
export function dayLabel(value: string) {
  return value.slice(0, 10).split("-").reverse().join("/");
}
export function momentLabel(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Não registrado";
}
export function scopedHref(path: string, params: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of ["person", "space", "month"]) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
