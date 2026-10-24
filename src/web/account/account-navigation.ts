import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

const paths = new Set([
  "/account",
  "/account/audit",
  "/account/transactions",
  "/account/rules",
  "/account/groups",
  "/account/sync",
  "/account/connections",
  "/account/design-system",
]);
const navigationEvent = "caderninho:navigate";
let navigationGuard: (() => boolean) | null = null;
export function guardWorkspaceNavigation(guard: () => boolean) {
  navigationGuard = guard;
  return () => {
    if (navigationGuard === guard) {
      navigationGuard = null;
    }
  };
}

export function isWorkspaceUrl(destination: URL, current: URL) {
  return (
    destination.origin === current.origin &&
    paths.has(destination.pathname) &&
    !destination.hash
  );
}

function currentRoute() {
  return location.pathname + location.search;
}
function subscribe(notify: () => void) {
  let route = currentRoute();
  const changed = () => {
    route = currentRoute();
    notify();
  };
  const popped = () => {
    if (navigationGuard && !navigationGuard()) {
      // Keep the draft mounted when Back is used; discard closes the editor first.
      history.pushState(null, "", route);
      return;
    }
    changed();
  };
  window.addEventListener("popstate", popped);
  window.addEventListener(navigationEvent, changed);
  return () => {
    window.removeEventListener("popstate", popped);
    window.removeEventListener(navigationEvent, changed);
  };
}
export function navigateWorkspace(url: URL) {
  if (url.pathname + url.search !== currentRoute()) {
    history.pushState(null, "", url.pathname + url.search);
  }
  window.dispatchEvent(new Event(navigationEvent));
}
function click(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return;
  }
  const link = event.target.closest("a");
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self")
  ) {
    return;
  }
  const url = new URL(link.href);
  if (!isWorkspaceUrl(url, new URL(location.href))) {
    return;
  }
  event.preventDefault();
  if (navigationGuard && !navigationGuard()) {
    return;
  }
  navigateWorkspace(url);
}
function submit(event: SubmitEvent) {
  const form = event.target;
  if (
    event.defaultPrevented ||
    !(form instanceof HTMLFormElement) ||
    form.method !== "get" ||
    (form.target && form.target !== "_self") ||
    event.submitter?.hasAttribute("formaction") ||
    event.submitter?.hasAttribute("formmethod") ||
    event.submitter?.hasAttribute("formtarget")
  ) {
    return;
  }
  const url = new URL(form.action);
  if (!isWorkspaceUrl(url, new URL(location.href))) {
    return;
  }
  url.search = "";
  for (const [key, value] of new FormData(form, event.submitter)) {
    if (typeof value === "string") {
      url.searchParams.append(key, value);
    }
  }
  event.preventDefault();
  if (navigationGuard && !navigationGuard()) {
    return;
  }
  navigateWorkspace(url);
}

export function useAccountNavigation() {
  const route = useSyncExternalStore(subscribe, currentRoute, () => "/account");
  const previous = useRef(route);
  useEffect(() => {
    document.addEventListener("click", click);
    document.addEventListener("submit", submit);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("submit", submit);
    };
  }, []);
  useLayoutEffect(() => {
    if (previous.current === route) {
      return;
    }
    previous.current = route;
    document
      .querySelector<HTMLElement>("#workspace-content")
      ?.focus({ preventScroll: true });
    document
      .querySelector<HTMLElement>(".workspace-main")
      ?.scrollTo({ behavior: "instant", top: 0 });
  }, [route]);
  return route;
}
