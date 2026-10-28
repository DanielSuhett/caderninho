// The current page's code starts downloading beside the shared bundles.
import("./account/route-preload").then(
  ({ preloadCurrentPage }) => preloadCurrentPage(),
  () => undefined,
);
const { mountAccount } = await import("./mount-account");
mountAccount();

// Module scope for top-level await; the entry has no static imports.
export {};
