import { Banner } from "@cloudflare/kumo/components/banner";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import type { AccountApi } from "./account-api";
import {
  accountPath,
  workspaceBasePath,
  workspaceHref,
} from "./account-navigation";
import { DisclosureItem } from "./disclosure-item";
import type { ViewCache } from "./read-cache";

export const ResourceVersion = createContext(0);

// Before data exists, a slow first read waits LOADING_DELAY and then shows the
// placeholder answer, if one was given.
const LOADING_DELAY = 150;

// With a view cache, a page the user returns to renders its last result at
// once and refreshes quietly; errors still surface over the stale data.
export function useResource<T>(
  load: (signal: AbortSignal, fresh: boolean) => Promise<T>,
  view?: ViewCache<T>,
  placeholder?: (signal: AbortSignal) => Promise<T>,
) {
  const [version, setVersion] = useState(0);
  const sourceVersion = useContext(ResourceVersion);
  const previousVersion = useRef(sourceVersion);
  const previousLoad = useRef(load);
  const [key] = useState(() => location.pathname + location.search);
  const [state, setState] = useState<{
    data: T | undefined;
    error: boolean;
    loading: boolean;
    placeholder?: T;
  }>(() => {
    const data = view?.get(key);
    return { data, error: false, loading: data === undefined };
  });
  const quiet = useRef(state.data !== undefined);
  const retry = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const sameQuery = previousLoad.current === load;
    previousLoad.current = load;
    const sourceChanged = previousVersion.current !== sourceVersion;
    previousVersion.current = sourceVersion;
    const revalidating = quiet.current;
    quiet.current = false;
    if (!revalidating) {
      setState((previous) => ({
        data: sameQuery ? previous.data : undefined,
        error: false,
        loading: true,
      }));
    }
    const timer =
      placeholder &&
      setTimeout(() => {
        // Best effort: without a placeholder the page stays blank until data.
        tryCatch(() => placeholder(controller.signal)).then(
          ({ data, error }) => {
            if (controller.signal.aborted || error) {
              return;
            }
            setState((previous) =>
              previous.loading && previous.data === undefined
                ? { ...previous, placeholder: data }
                : previous,
            );
          },
          () => undefined,
        );
      }, LOADING_DELAY);
    tryCatch(() => load(controller.signal, version > 0 || sourceChanged)).then(
      ({ data, error }) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error) {
          setState((previous) => ({
            data: previous.data,
            error: true,
            loading: false,
          }));
          return;
        }
        view?.set(key, data);
        setState({ data, error: false, loading: false });
      },
      () => undefined,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, placeholder, version, sourceVersion, view, key]);
  return {
    data: state.data ?? state.placeholder,
    error: state.error,
    loading: state.loading,
    placeholder: state.data === undefined && state.placeholder !== undefined,
    retry,
  };
}

// A page read whose first slow load renders the page itself over demo
// answers, so the skeleton matches what the page will show.
export function usePageResource<T, Read extends keyof AccountApi>(
  api: Pick<AccountApi, Read>,
  load: (
    api: Pick<AccountApi, Read>,
    signal: AbortSignal,
    fresh: boolean,
  ) => Promise<T>,
  view?: ViewCache<T>,
) {
  const read = useCallback(
    (signal: AbortSignal, fresh: boolean) => load(api, signal, fresh),
    [api, load],
  );
  const placeholder = useCallback(
    async (signal: AbortSignal) => {
      const { placeholderApi } = await import("../demo-placeholder");
      return load(placeholderApi(), signal, false);
    },
    [load],
  );
  return useResource(read, view, placeholder);
}

// Placeholder content keeps the real layout but hides every value behind a
// bar and takes no input; the real content mounts fresh when it arrives.
export function ResourcePlaceholder({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  if (!active) {
    return children;
  }
  return (
    <div
      aria-hidden
      className="resource-placeholder"
      inert
    >
      {children}
    </div>
  );
}
export function ResourceFeedback({
  error,
  loading,
  retry,
  data,
  placeholder,
}: {
  error: boolean;
  loading: boolean;
  retry: () => void;
  data?: unknown;
  placeholder?: boolean;
}) {
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), LOADING_DELAY);
    return () => clearTimeout(timer);
  }, [loading]);
  const first = new URLSearchParams(location.search);
  first.delete("cursor");
  first.delete("grantCursor");
  if (placeholder || (loading && !data)) {
    return showLoading ? (
      <span
        className="sr-only"
        role="status"
      >
        Carregando dados salvos…
      </span>
    ) : null;
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
                  <a
                    href={
                      workspaceBasePath() === "/demo"
                        ? "/demo/"
                        : "/account/login"
                    }
                  >
                    {workspaceBasePath() === "/demo"
                      ? "Restaurar demonstração"
                      : "Entrar novamente"}
                  </a>
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
  const keys = ["person", "space", "month", "currency"];
  if (
    [
      "/account",
      "/account/transactions",
      "/account/cards",
      "/account/investments",
    ].includes(accountPath(path))
  ) {
    keys.push("institutionId", "cardBrand");
  }
  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }
  return `${workspaceHref(path)}${query.size ? `?${query}` : ""}`;
}
