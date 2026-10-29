// The current page's code starts downloading beside the shared bundles.
import("./account/route-preload").then(
  ({ preloadCurrentPage }) => preloadCurrentPage(),
  () => undefined,
);
// The installation state arrives inline with the page, so the current page's
// first requests start while the panel's code is still downloading.
const client = Promise.all([
  import("./account/account-api"),
  import("./account/page-requests"),
]).then(([{ createAccountApi, readBoot }, { startPageRequests }]) => {
  const boot = readBoot();
  const api = createAccountApi(location.origin, fetch, boot);
  startPageRequests(api, boot);
  return api;
});
const [{ mountAccount }, api] = await Promise.all([
  import("./mount-account"),
  client,
]);
mountAccount({ api });

// Module scope for top-level await; the entry has no static imports.
export {};
