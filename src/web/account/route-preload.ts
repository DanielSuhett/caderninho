import { tryCatch } from "../../shared";
import { accountPath } from "./account-navigation";

// Kept apart from the workspace shell so an entry can start the current
// page's download in parallel with the shared bundles instead of after them.
const pageModules: Record<string, (() => Promise<unknown>) | undefined> = {
  "/account": () => import("./overview-view"),
  "/account/audit": () => import("./audit-view"),
  "/account/cards": () => import("./cards-view"),
  "/account/categories": () => import("./organization-view"),
  "/account/connections": () => import("./dashboard-view"),
  "/account/investments": () => import("./investments-view"),
  "/account/reserve": () => import("./reserve-view"),
  "/account/rules": () => import("./organization-view"),
  "/account/transactions": () => import("./transactions-view"),
};

export const pageLoaders = Object.values(pageModules).filter(
  (load) => load !== undefined,
);

// Warm code only; queries still belong to the mounted page.
export function warmPage(pathname: string) {
  const load = pageModules[accountPath(pathname)];
  if (load) {
    tryCatch(load).then(
      ({ data: _data, error: _error }) => undefined,
      () => undefined,
    );
  }
}

// The current page's code downloads while the installation is being read.
export function preloadCurrentPage() {
  warmPage(location.pathname);
}
