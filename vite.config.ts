import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

import { demoPage } from "./src/web/demo-page";
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
      await Promise.all(
        [output, site].map((destination) =>
          copyFile(
            new URL("src/web/theme-init.ts", root),
            new URL("theme.js", destination),
          ),
        ),
      );
      await writeFile(new URL("index.html", output), renderPage(landingPage()));
      await writeFile(
        new URL("index.html", site),
        renderPage(landingPage({ publicSite: true })),
      );
      await writeFile(new URL("404.html", site), renderPage(notFoundPage()));
      await Promise.all(
        [output, site].map(async (destination) => {
          await Promise.all(
            [
              "demo",
              "demo/transactions",
              "demo/cards",
              "demo/investments",
              "demo/rules",
              "demo/groups",
            ].map(async (path) => {
              await mkdir(new URL(`${path}/`, destination), {
                recursive: true,
              });
              await writeFile(
                new URL(`${path}/index.html`, destination),
                renderPage(demoPage()),
              );
            }),
          );
        }),
      );
      await cp(new URL("rule-packs/", output), new URL("rule-packs/", site), {
        recursive: true,
      });
      await cp(new URL("chunks/", output), new URL("chunks/", site), {
        recursive: true,
      });
      await Promise.all(
        ["demo.js", "landing.js", "account.css"].map((name) =>
          copyFile(new URL(name, output), new URL(name, site)),
        ),
      );

      const [standalone, components] = await Promise.all([
        readFile(
          new URL(import.meta.resolve("@cloudflare/kumo/styles/standalone")),
          "utf8",
        ),
        readFile(
          new URL(import.meta.resolve("@cloudflare/kumo/styles/tailwind")),
          "utf8",
        ),
      ]);
      // 2.14 standalone omits the library's Calendar styles. Preserve its
      // official component CSS; the Tailwind binding is already in standalone.
      await writeFile(
        new URL("kumo.css", output),
        `${standalone}\n${components.replace('@import "./kumo-binding.css";', "")}`,
      );
      await mkdir(new URL("fonts/", output), { recursive: true });
      await mkdir(new URL("fonts/", site), { recursive: true });
      await Promise.all(
        [output, site].flatMap((destination) => [
          ...["design.css", "public.css", "landing.css"].map((name) =>
            copyFile(
              new URL(`src/web/styles/${name}`, root),
              new URL(name, destination),
            ),
          ),
          ...["InterVariable.woff2", "Inter-LICENSE.txt"].map((name) =>
            copyFile(
              new URL(`src/web/assets/fonts/${name}`, root),
              new URL(`fonts/${name}`, destination),
            ),
          ),
        ]),
      );
      await writeFile(
        new URL("_headers", output),
        `/*\n  Referrer-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.pluggy.ai/assets/connector-icons/; frame-ancestors 'none'; base-uri 'none'; form-action 'self'\n\n/chunks/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
      );
      await Promise.all(
        ["kumo.css", "_headers"].map((name) =>
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
    cssCodeSplit: false,
    outDir: "dist/web",
    rolldownOptions: {
      input: {
        account: fileURLToPath(
          new URL("./src/web/account-entry.ts", import.meta.url),
        ),
        demo: fileURLToPath(
          new URL("./src/web/demo-entry.ts", import.meta.url),
        ),
        landing: fileURLToPath(
          new URL("./src/web/landing-entry.ts", import.meta.url),
        ),
      },
      output: {
        assetFileNames: ({ names }) =>
          names.some((name) => name.endsWith(".css"))
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
