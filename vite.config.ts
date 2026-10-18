import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

function copyPortalAssets(): Plugin {
  return {
    name: "copy-portal-assets",
    async closeBundle() {
      const root = new URL("./", import.meta.url);
      const output = new URL("dist/web/", root);
      await mkdir(output, { recursive: true });
      await copyFile(
        new URL("src/web/assets/fonts/hanken-grotesk.ttf", root),
        new URL("hanken-grotesk.ttf", output),
      );
      await copyFile(
        new URL(import.meta.resolve("@cloudflare/kumo/styles/standalone")),
        new URL("kumo.css", output),
      );
      await writeFile(
        new URL("_headers", output),
        `/*\n  Referrer-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\n`,
      );
    },
  };
}

export default defineConfig({
  plugins: [copyPortalAssets()],
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
