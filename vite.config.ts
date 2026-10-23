import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

import { renderPage } from "./src/web/document";
import { landingPage } from "./src/web/landing-view";
import { notFoundPage } from "./src/web/not-found-view";

function copyPortalAssets(): Plugin {
  return {
    async closeBundle() {
      const root = new URL("./", import.meta.url);
      const output = new URL("dist/web/", root);
      const site = new URL("dist/site/", root);
      await mkdir(output, { recursive: true });
      await mkdir(site, { recursive: true });
      await writeFile(new URL("index.html", output), renderPage(landingPage()));
      await writeFile(
        new URL("index.html", site),
        renderPage(landingPage({ publicSite: true })),
      );
      await writeFile(new URL("404.html", site), renderPage(notFoundPage()));
      await copyFile(
        new URL("src/web/assets/fonts/OFL.txt", root),
        new URL("OFL.txt", site),
      );
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
        `/*\n  Referrer-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\n\n/chunks/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
      );
      await Promise.all(
        ["hanken-grotesk.ttf", "kumo.css", "_headers"].map((name) =>
          copyFile(new URL(name, output), new URL(name, site)),
        ),
      );
      await writeFile(
        new URL("robots.txt", site),
        "User-agent: *\nAllow: /\nSitemap: https://usecaderninho.com/sitemap.xml\n",
      );
      await writeFile(
        new URL("sitemap.xml", site),
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://usecaderninho.com/</loc></url></urlset>\n',
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
