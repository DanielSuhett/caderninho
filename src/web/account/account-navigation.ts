const paths = new Set([
  "/account",
  "/account/cards",
  "/account/audit",
  "/account/transactions",
  "/account/investments",
  "/account/reserve",
  "/account/rules",
  "/account/categories",
  "/account/sync",
  "/account/connections",
]);
const trailingSlash = /\/$/;

export function workspaceBasePath(
  pathname = typeof location === "undefined" ? "/account" : location.pathname,
) {
  return pathname === "/demo" || pathname.startsWith("/demo/")
    ? "/demo"
    : "/account";
}

export function accountPath(pathname: string) {
  const path = pathname.replace(trailingSlash, "");
  return workspaceBasePath(path) === "/demo"
    ? `/account${path.slice("/demo".length)}`
    : path;
}

export function workspaceHref(path: string, pathname?: string) {
  if (
    !(
      path === "/account" ||
      path.startsWith("/account/") ||
      path.startsWith("/account?")
    )
  ) {
    return path;
  }
  return workspaceBasePath(pathname) + path.slice("/account".length);
}
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
    workspaceBasePath(destination.pathname) ===
      workspaceBasePath(current.pathname) &&
    paths.has(accountPath(destination.pathname)) &&
    !destination.hash
  );
}

export function currentRoute() {
  return location.pathname + location.search;
}
export function subscribeNavigation(notify: () => void) {
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

// Same-origin workspace links and GET forms navigate without a reload.
export function interceptNavigation() {
  document.addEventListener("click", click);
  document.addEventListener("submit", submit);
  return () => {
    document.removeEventListener("click", click);
    document.removeEventListener("submit", submit);
  };
}
