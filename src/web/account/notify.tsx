import type { KumoToastManagerAddOptions } from "@cloudflare/kumo/components/toast";
import { lazy, Suspense, useSyncExternalStore } from "react";

import { tryCatch } from "../../shared";

type Notice = KumoToastManagerAddOptions<object>;

// Toasts are rare; Kumo's toaster downloads with the first notice.
const pending: Notice[] = [];
let deliver: ((notice: Notice) => void) | null = null;
let requested = false;
const listeners = new Set<() => void>();

export function notify(notice: Notice) {
  if (deliver) {
    deliver(notice);
    return;
  }
  pending.push(notice);
  if (!requested) {
    requested = true;
    for (const listener of listeners) {
      listener();
    }
  }
}

export function connectToaster(add: (notice: Notice) => void) {
  deliver = add;
  for (const notice of pending.splice(0)) {
    add(notice);
  }
  return () => {
    if (deliver === add) {
      deliver = null;
    }
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const ToastLayer = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./toast-layer"));
  return { default: error ? () => null : data.ToastLayer };
});

export function Toaster() {
  const visible = useSyncExternalStore(
    subscribe,
    () => requested,
    () => false,
  );
  if (!visible) {
    return null;
  }
  return (
    <Suspense>
      <ToastLayer />
    </Suspense>
  );
}
