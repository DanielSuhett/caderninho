import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./tests/integration/wrangler.jsonc" },
      miniflare: {
        kvNamespaces: ["OAUTH_KV"],
        bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations") },
      },
    }),
  ],
  // Vitest 5 defaults to reading host filesystem caches inside the isolate.
  // Workers has a virtual filesystem; use the plugin module transport instead.
  test: {
    fsModuleCache: false,
    include: ["./tests/integration/*.test.ts"],
    testTimeout: 30000,
  },
});
