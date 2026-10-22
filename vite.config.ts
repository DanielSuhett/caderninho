import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

import { renderPage } from "./src/web/document";
import { landingPage } from "./src/web/landing-view";

function copyPortalAssets(): Plugin {
  return {
    async closeBundle() {
      const root = new URL("./", import.meta.url);
      const output = new URL("dist/web/", root);
      await mkdir(output, { recursive: true });
      await writeFile(new URL("index.html", output), renderPage(landingPage()));
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
    name: "copy-portal-assets",
  };
}

export default defineConfig({
  build: {
    outDir: "dist/web",
    rolldownOptions: {
      input: {
        account: fileURLToPath(
          new URL("./src/web/account-entry.ts", import.meta.url),
        ),
      },
      output: {
        assetFileNames: ({ names }) =>
          names.includes("mount-account.css")
            ? "account.css"
            : "[name][extname]",
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "[name].js",
        manualChunks: (id) =>
          id.includes("/node_modules/zod/") ? "validation" : undefined,
      },
    },
    target: "es2022",
  },
  plugins: [copyPortalAssets()],
});
