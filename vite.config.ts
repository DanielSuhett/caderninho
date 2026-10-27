import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import bancos from "logos-bancos-br/data/bancos.json" with { type: "json" };
import { defineConfig, type Plugin } from "vite";

import { renderPage } from "./src/web/document";
import { landingPage } from "./src/web/landing-view";
import { notFoundPage } from "./src/web/not-found-view";
import { accountPage } from "./src/web/portal-view";

const domainSchema = /\/src\/domain\/[^/]+\.schema\.ts$/;

const phosphorDefinition = /\/@phosphor-icons\/react\/dist\/defs\/\w+\.es\.js$/;
const unusedIconWeight =
  /^ {2}\[\n {4}"(?:duotone|light|thin)",\n[\s\S]*?\n {2}\],?$\n?/gm;

// Phosphor ships six weights per icon. The product and Kumo render only
// regular, bold and fill, so the other paths never reach the browser.
function phosphorWeights(): Plugin {
  return {
    name: "phosphor-weights",
    transform(code, id) {
      if (phosphorDefinition.test(id)) {
        return code.replace(unusedIconWeight, "");
      }
    },
  };
}

// Bank logos ship as static assets named by COMPE; they never enter a JS bundle.
async function copyBankLogos(destination: URL) {
  const base = new URL(
    "./",
    import.meta.resolve("logos-bancos-br/package.json"),
  );
  await mkdir(new URL("bancos/", destination), { recursive: true });
  // The logos are trademarks of their institutions; keep the package notice.
  await Promise.all(
    ["DISCLAIMER.md", "LICENSE"].map((name) =>
      copyFile(new URL(name, base), new URL(`bancos/${name}`, destination)),
    ),
  );
  await Promise.all(
    bancos.banks.flatMap((bank) => {
      const logo = bank.logo?.svg;
      if (!(bank.compe && logo)) {
        return [];
      }
      return copyFile(
        new URL(logo, base),
        new URL(`bancos/${bank.compe}.svg`, destination),
      );
    }),
  );
}

function copyPortalAssets(): Plugin {
  return {
    async closeBundle() {
      const root = new URL("./", import.meta.url);
      const output = new URL("dist/web/", root);
      const site = new URL("dist/site/", root);
      await mkdir(output, { recursive: true });
      await mkdir(site, { recursive: true });
      await copyBankLogos(output);
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
              "demo/connections",
              "demo/sync",
              "demo/audit",
              "demo/design-system",
            ].map(async (path) => {
              await mkdir(new URL(`${path}/`, destination), {
                recursive: true,
              });
              await writeFile(
                new URL(`${path}/index.html`, destination),
                renderPage(accountPage({ demo: true })),
              );
            }),
          );
        }),
      );
      await Promise.all(
        [output, site].map((destination) =>
          cp(
            new URL("src/web/assets/demo-people/", root),
            new URL("demo-people/", destination),
            { recursive: true },
          ),
        ),
      );
      await cp(new URL("rule-packs/", output), new URL("rule-packs/", site), {
        recursive: true,
      });
      await cp(new URL("chunks/", output), new URL("chunks/", site), {
        recursive: true,
      });
      await Promise.all(
        [
          "demo.js",
          "landing.js",
          "preload-helper.js",
          "account.css",
          "social-card.png",
          "social-card-open-source-v3.png",
          "favicon.ico",
          "favicon.png",
          "apple-touch-icon.png",
        ].map((name) => copyFile(new URL(name, output), new URL(name, site))),
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
          // Versioned subsets: rename the file whenever its glyphs change.
          ...[
            "Inter-4.001-latin.woff2",
            "Inter-LICENSE.txt",
            "SourceSerif4-4.005-latin-500.woff2",
            "SourceSerif4-LICENSE.md",
          ].map((name) =>
            copyFile(
              new URL(`src/web/assets/fonts/${name}`, root),
              new URL(`fonts/${name}`, destination),
            ),
          ),
        ]),
      );
      await writeFile(
        new URL("_headers", output),
        `/*\n  Referrer-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.pluggy.ai/assets/connector-icons/; frame-ancestors 'none'; base-uri 'none'; form-action 'self'\n\n/chunks/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*.woff2\n  Cache-Control: public, max-age=31536000, immutable\n\n/bancos/*\n  Cache-Control: public, max-age=86400\n`,
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
        access: fileURLToPath(
          new URL("./src/web/access-entry.tsx", import.meta.url),
        ),
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
        // Entries import the helper statically; a stable root name lets HTML
        // modulepreload it instead of adding a round trip after each entry.
        chunkFileNames: ({ name }) =>
          name === "preload-helper"
            ? "preload-helper.js"
            : "chunks/[name]-[hash].js",
        codeSplitting: {
          groups: [
            // Zod's config is tiny; the validator loads only with schemas.
            {
              name: "validation-config",
              priority: 3,
              test: /\/node_modules\/zod\/v4\/core\/(core|util)\.js$|\/src\/web\/validation-config\.ts$/,
            },
            { name: "validation", priority: 2, test: /\/node_modules\/zod\// },
            { name: "result", priority: 1, test: /\/src\/shared\/result\.ts$/ },
          ],
        },
        entryFileNames: "[name].js",
      },
      // Contracts and domain schemas only construct Zod objects at load time.
      // Pages that never parse an input should not download the validator.
      treeshake: {
        moduleSideEffects: (id) =>
          !(id.includes("/src/contracts/") || domainSchema.test(id)),
      },
    },
    target: "es2022",
  },
  plugins: [phosphorWeights(), copyPortalAssets()],
});
