// The current page's code starts downloading beside the shared bundles.
import("./account/route-preload").then(
  ({ preloadCurrentPage }) => preloadCurrentPage(),
  () => undefined,
);
const [{ mountAccount }, { createDemoFetch }, { createAccountApi }] =
  await Promise.all([
    import("./mount-account"),
    import("./demo-api"),
    import("./account/account-api"),
  ]);
mountAccount({
  api: createAccountApi(location.origin, createDemoFetch(location.origin)),
  demo: true,
});

// Module scope for top-level await; the entry has no static imports.
export {};
