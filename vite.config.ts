import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/web",
    target: "es2022",
    rolldownOptions: {
      input: {
        account: fileURLToPath(
          new URL("./src/web/account-entry.ts", import.meta.url),
        ),
      },
      output: {
        manualChunks: (id) =>
          id.includes("/node_modules/zod/") ? "validation" : undefined,
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
