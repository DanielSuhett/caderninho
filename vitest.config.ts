import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations") },
        kvNamespaces: ["OAUTH_KV"],
      },
      wrangler: { configPath: "./tests/integration/wrangler.jsonc" },
    }),
  ],
  // Vitest 5 defaults to reading host filesystem caches inside the isolate.
  // Workers has a virtual filesystem; use the plugin module transport instead.
  test: {
    fsModuleCache: false,
    include: ["./tests/integration/*.test.ts"],
    testTimeout: 30_000,
  },
});
