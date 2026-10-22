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
  window.addEventListener("popstate", notify);
  window.addEventListener(navigationEvent, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(navigationEvent, notify);
  };
}
function closePanels() {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    if (dialog instanceof HTMLDialogElement) {
      dialog.close();
    }
  }
}
function navigate(url: URL) {
  closePanels();
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
  navigate(url);
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
  navigate(url);
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
    closePanels();
    document
      .querySelector<HTMLElement>("#workspace-content")
      ?.focus({ preventScroll: true });
    window.scrollTo({ behavior: "instant", top: 0 });
  }, [route]);
  return route;
}
