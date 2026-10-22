import { useCallback, useEffect, useState } from "react";

import { tryCatch } from "../../shared";
import { UiButton } from "../ui";

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    data: T | undefined;
    error: boolean;
    loading: boolean;
    request: number;
  }>({ data: undefined, error: false, loading: true, request: 0 });
  const retry = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({
      data: undefined,
      error: false,
      loading: true,
      request: version,
    });
    tryCatch(() => load(controller.signal)).then(
      ({ data, error }) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error) {
          setState({
            data: undefined,
            error: true,
            loading: false,
            request: version,
          });
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
}: {
  error: boolean;
  loading: boolean;
  retry: () => void;
}) {
  const first = new URLSearchParams(location.search);
  first.delete("cursor");
  if (loading) {
    return (
      <p
        className="workspace-feedback"
        role="status"
      >
        Carregando dados salvos…
      </p>
    );
  }
  if (error) {
    return (
      <div
        className="notice"
        role="alert"
      >
        <p>
          Não foi possível consultar esta visão. Confira os filtros, renove a
          sessão ou reabra a lista se os dados mudaram durante a paginação.
        </p>
        <UiButton
          onClick={retry}
          type="button"
          variant="secondary"
        >
          Tentar novamente
        </UiButton>{" "}
        <a href={`${location.pathname}?${first}`}>Reabrir do início</a> ·{" "}
        <a href={location.pathname}>Limpar todos os filtros</a> ·{" "}
        <a href="/account/login">Entrar novamente</a>
      </div>
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
  for (const key of ["person", "space"]) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
