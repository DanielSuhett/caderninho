import {
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useState,
} from "react";

import { tryCatch } from "../../shared";

// Hidden surfaces (dialogs, menus, editors) download when first shown instead
// of with the page. A failed download leaves the surface closed; the next
// render tries again. The fallback keeps a visible trigger in place meanwhile.
const surfaces = new Set<() => Promise<unknown>>();

export function deferred<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: (props: P) => ReactNode = () => null,
) {
  surfaces.add(load);
  const attempt = async (): Promise<{ default: ComponentType<P> }> => {
    const { data, error } = await tryCatch(load);
    if (error) {
      Loaded = lazy(attempt);
      return { default: () => null };
    }
    return { default: data };
  };
  let Loaded = lazy(attempt);
  return function Deferred(props: P) {
    return (
      <Suspense fallback={fallback(props)}>
        <Loaded {...props} />
      </Suspense>
    );
  };
}

// Stays true after the first opening so closing animations can finish.
export function useShown(open: boolean) {
  const [shown, setShown] = useState(open);
  if (open && !shown) {
    setShown(true);
  }
  return shown || open;
}

// A visible trigger that becomes the real Kumo surface once someone reaches
// for it: hovering mounts it closed (so its own hover behavior takes over),
// activating mounts it open. Keyboard activation is a click, so focus moves
// into the surface and returns to its trigger on close.
export function useIntent(load: () => Promise<unknown>) {
  const [intent, setIntent] = useState<"idle" | "hover" | "open">("idle");
  const warm = useCallback(() => prefetch(load), [load]);
  const hover = useCallback(() => {
    prefetch(load);
    setIntent((current) => (current === "idle" ? "hover" : current));
  }, [load]);
  const open = useCallback(() => setIntent("open"), []);
  return { hover, intent, open, warm };
}

// Starts a download on intent (hover, focus) so the first click feels instant.
export function prefetch(load: () => Promise<unknown>) {
  tryCatch(load).then(
    ({ data: _data, error: _error }) => undefined,
    () => undefined,
  );
}

function saveData() {
  const connection =
    "connection" in navigator ? navigator.connection : undefined;
  return (
    typeof connection === "object" &&
    connection !== null &&
    "saveData" in connection &&
    connection.saveData === true
  );
}

function whenIdle(run: () => void) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 4000 });
    return;
  }
  setTimeout(run, 500);
}

// After the first page settles, the remaining code downloads one module at a
// time while the browser is idle, so later clicks never wait for the network.
// Data is never prefetched, and nothing runs when the browser asks to save data.
export function warmWhenIdle(pages: Array<() => Promise<unknown>>) {
  if (saveData()) {
    return;
  }
  const queue = [...pages, ...surfaces];
  const next = () => {
    const load = queue.shift();
    if (load) {
      tryCatch(load).then(
        () => whenIdle(next),
        () => whenIdle(next),
      );
    }
  };
  setTimeout(() => whenIdle(next), 2000);
}
