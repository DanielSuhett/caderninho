import { z } from "zod/v4";

z.config({ jitless: true });
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
