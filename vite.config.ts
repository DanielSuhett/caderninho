import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";

import bancos from "logos-bancos-br/data/bancos.json" with { type: "json" };
import postcss from "postcss";
import { defineConfig, type Plugin } from "vite";

import { renderPage } from "./src/web/document";
import { landingPage } from "./src/web/landing-view";
import { notFoundPage } from "./src/web/not-found-view";
import { accountPage } from "./src/web/portal-view";

const phosphorDefinition = /\/@phosphor-icons\/react\/dist\/defs\/\w+\.es\.js$/;
const unusedIconWeight =
  /^ {2}\[\n {4}"(?:duotone|light|thin)",\n[\s\S]*?\n {2}\],?$\n?/gm;

// Phosphor ships six weights per icon. The product and Kumo render only
// regular, bold and fill, so the other paths never reach the browser.
const zodCore = /\/node_modules\/zod\/v4\/core\/core\.js$/;

// CSP forbids eval, so Zod must not try its JIT path. Setting it where Zod
// defines its config applies it whenever a page loads the validator, without
// shipping Zod to pages that never validate.
function zodWithoutEval(): Plugin {
  return {
    name: "zod-without-eval",
    transform(code, id) {
      if (zodCore.test(id)) {
        return `${code}\nconfig({ jitless: true });\n`;
      }
    },
  };
}

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

const rootViewBox = /<svg\b[^>]*?\sviewBox="([^"]+)"/;
const firstRect = /<rect\b[^>]*>/;
const rectWidthAttr = /\swidth="([\d.]+)"/;
const rectHeightAttr = /\sheight="([\d.]+)"/;
const solidFill = /\sfill="(?!none|white|#fff)/i;
const viewBoxSeparator = /[\s,]+/;
// The avatar paints the logo edge to edge inside a circle. Logos with a
// full-bleed background are cropped to the circle as they are; transparent ones
// get a wider viewBox so the symbol keeps its margin.
function fitLogoToCircle(svg: string) {
  const viewBox = rootViewBox.exec(svg)?.[1];
  const [x = Number.NaN, y = Number.NaN, width, height] = (viewBox ?? "")
    .split(viewBoxSeparator)
    .map(Number);
  if (!(width && height) || [x, y].some(Number.isNaN)) {
    return svg;
  }
  const rect = firstRect.exec(svg)?.[0] ?? "";
  const rectWidth = Number(rectWidthAttr.exec(rect)?.[1]);
  const rectHeight = Number(rectHeightAttr.exec(rect)?.[1]);
  const fillsCanvas =
    Math.abs(rectWidth - width) < 1 &&
    Math.abs(rectHeight - height) < 1 &&
    solidFill.test(rect);
  if (fillsCanvas) {
    return svg;
  }
  const grow = 4 / 3;
  const widened = [
    x - (width * (grow - 1)) / 2,
    y - (height * (grow - 1)) / 2,
    width * grow,
    height * grow,
  ].join(" ");
  return svg.replace(`viewBox="${viewBox}"`, `viewBox="${widened}"`);
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
      return readFile(new URL(logo, base), "utf8").then((svg) =>
        writeFile(
          new URL(`bancos/${bank.compe}.svg`, destination),
          fitLogoToCircle(svg),
        ),
      );
    }),
  );
}

function contentHash(text: string) {
  return createHash("sha256").update(text).digest("base64url").slice(0, 10);
}

const classSelector = /\.((?:\\.|[\w-])+)/g;
const cssEscape = /\\(.)/g;
const classSeparator = /[\s"'`]+/;
const markupFile = /\.(?:js|html|tsx?)$/;

async function markupText(directory: URL): Promise<string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          markupFile.test(entry.name) &&
          !entry.parentPath.includes("__tests__"),
      )
      .map((entry) => readFile(`${entry.parentPath}/${entry.name}`, "utf8")),
  );
}

// Kumo's standalone sheet carries utilities for every component in the
// library. Tailwind only emits classes written literally, so a rule whose
// classes never appear in the shipped bundles or server-rendered views is dead.
async function purgeKumo(css: string, sources: URL[]) {
  const texts = (await Promise.all(sources.map(markupText))).flat();
  const used = new Set(texts.flatMap((text) => text.split(classSeparator)));
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && rule.parent.name === "keyframes") {
      return;
    }
    const selectors = rule.selectors.filter((selector) =>
      // The day picker composes its rdp-* classes at runtime.
      [...selector.matchAll(classSelector)].every(
        ([, name = ""]) =>
          name.startsWith("rdp-") || used.has(name.replace(cssEscape, "$1")),
      ),
    );
    if (selectors.length) {
      rule.selectors = selectors;
      return;
    }
    rule.remove();
  });
  root.walkAtRules((rule) => {
    if (rule.nodes?.length === 0) {
      rule.remove();
    }
  });
  return root.toString();
}

// Paths below /account and /demo that serve the panel.
const workspacePages = [
  "",
  "/transactions",
  "/cards",
  "/investments",
  "/reserve",
  "/rules",
  "/categories",
  "/groups",
  "/connections",
  "/sync",
  "/audit",
];
const pageImport = /"\/account([^"]*)": \(\) => import\("\.\/([\w-]+)"\)/g;

// route-preload.ts owns the path → page module map; read it instead of
// repeating it here.
async function pageRoutes(root: URL) {
  const source = await readFile(
    new URL("src/web/account/route-preload.ts", root),
    "utf8",
  );
  const routes = new Map(
    [...source.matchAll(pageImport)].map(([, path = "", module = ""]) => [
      path,
      `/src/web/account/${module}.tsx`,
    ]),
  );
  if (!routes.size) {
    throw new Error("route-preload.ts no longer lists page imports");
  }
  return routes;
}

interface BuiltChunk {
  dynamicImports: string[];
  imports: string[];
  module: string | null;
}
let chunks = new Map<string, BuiltChunk>();
const entries = new Map<string, string>();
let accountStyles = "";

function staticFiles(file: string, found = new Set<string>()) {
  if (found.has(file)) {
    return found;
  }
  found.add(file);
  for (const dependency of chunks.get(file)?.imports ?? []) {
    staticFiles(dependency, found);
  }
  return found;
}

// What an entry loads before it renders: its own imports and the modules it
// imports dynamically at startup.
function bootFiles(entry: string) {
  const found = staticFiles(entry);
  for (const dependency of chunks.get(entry)?.dynamicImports ?? []) {
    staticFiles(dependency, found);
  }
  found.delete(entry);
  return found;
}

function pageFiles(module: string) {
  const file = [...chunks].find(([, chunk]) =>
    chunk.module?.endsWith(module),
  )?.[0];
  return file ? staticFiles(file) : new Set<string>();
}

function copyPortalAssets(): Plugin {
  return {
    async closeBundle() {
      const root = new URL("./", import.meta.url);
      const output = new URL("dist/web/", root);
      const site = new URL("dist/site/", root);
      await mkdir(output, { recursive: true });
      await mkdir(site, { recursive: true });
      const [standalone, components, design] = await Promise.all([
        readFile(
          new URL(import.meta.resolve("@cloudflare/kumo/styles/standalone")),
          "utf8",
        ),
        readFile(
          new URL(import.meta.resolve("@cloudflare/kumo/styles/tailwind")),
          "utf8",
        ),
        readFile(new URL("src/web/styles/design.css", root), "utf8"),
      ]);
      // 2.14 standalone omits the library's Calendar styles. Preserve its
      // official component CSS; the Tailwind binding is already in standalone.
      // The views' classes come from the bundles and src, so this runs before
      // any page is written.
      const kumo = await purgeKumo(
        `${standalone}\n${components.replace('@import "./kumo-binding.css";', "")}`,
        [output, new URL("src/", root)],
      );
      await writeFile(new URL("kumo.css", output), kumo);
      await copyFile(
        new URL(accountStyles, output),
        new URL("account.css", output),
      );
      const assets = {
        account: `/${accountStyles}`,
        stylesheets: await Promise.all(
          [
            ["kumo", kumo],
            ["design", design],
          ].map(async ([name = "", css = ""]) => {
            const file = `chunks/${name}-${contentHash(css)}.css`;
            await writeFile(new URL(file, output), css);
            return `/${file}`;
          }),
        ),
      };
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
      const routes = await pageRoutes(root);
      const shell = (entry: string, page: string) => {
        const files = bootFiles(entries.get(entry) ?? `${entry}.js`);
        const source = routes.get(page === "/sync" ? "/connections" : page);
        if (source) {
          for (const file of pageFiles(source)) {
            files.add(file);
          }
        }
        return [...files].sort();
      };
      await Promise.all(
        workspacePages.flatMap((page) => [
          ...[output, site].map(async (destination) => {
            const directory = new URL(`demo${page}/`, destination);
            await mkdir(directory, { recursive: true });
            await writeFile(
              new URL("index.html", directory),
              renderPage(
                accountPage({
                  assets: { ...assets, script: `/${entries.get("demo")}` },
                  demo: true,
                  preload: shell("demo", page),
                }),
              ),
            );
          }),
          (async () => {
            const directory = new URL(`account-shell${page}/`, output);
            await mkdir(directory, { recursive: true });
            await writeFile(
              new URL("index.html", directory),
              renderPage(
                accountPage({
                  assets: { ...assets, script: `/${entries.get("account")}` },
                  preload: shell("account", page),
                }),
              ),
            );
          })(),
        ]),
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
          "account.css",
          "social-card.png",
          "social-card-open-source-v3.png",
          "favicon.ico",
          "favicon.png",
          "apple-touch-icon.png",
        ].map((name) => copyFile(new URL(name, output), new URL(name, site))),
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
        `/*\n  Referrer-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.pluggy.ai/assets/connector-icons/; frame-ancestors 'none'; base-uri 'none'; form-action 'self'\n\n/chunks/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*.woff2\n  Cache-Control: public, max-age=31536000, immutable\n\n/bancos/*\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400\n\n/demo-people/*\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400\n\n/*.svg\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400\n`,
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
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === "chunk" && item.isEntry) {
          entries.set(item.name, item.fileName);
          this.emitFile({
            fileName: `${item.name}.js`,
            source: `import "./${item.fileName}";\n`,
            type: "asset",
          });
        }
      }
      chunks = new Map(
        Object.values(bundle).flatMap((item) =>
          item.type === "chunk"
            ? [
                [
                  item.fileName,
                  {
                    dynamicImports: item.dynamicImports,
                    imports: item.imports,
                    module: item.facadeModuleId,
                  },
                ],
              ]
            : [],
        ),
      );
    },
    name: "copy-portal-assets",
    // Vite emits the stylesheet after the plugins' generateBundle.
    writeBundle(_options, bundle) {
      accountStyles =
        Object.keys(bundle).find((file) => file.endsWith(".css")) ?? "";
    },
  };
}

export default defineConfig({
  build: {
    // Card brands are cached image files; inlined, they ride in every list chunk.
    assetsInlineLimit: (file) => (file.endsWith(".svg") ? false : undefined),
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
        // Hashed names live under /chunks/, which is cached as immutable.
        // Stable names (account.js, account.css) are copies for pages the
        // Worker renders at runtime.
        assetFileNames: ({ names }) =>
          names.some((name) => name.endsWith(".css"))
            ? "chunks/account-[hash].css"
            : "[name][extname]",
        chunkFileNames: "chunks/[name]-[hash].js",
        codeSplitting: {
          groups: [
            { name: "validation", priority: 2, test: /\/node_modules\/zod\// },
            // Every interactive page boots the same renderer; one file
            // compresses better than several and skips their preambles.
            {
              name: "react",
              priority: 2,
              test: /\/node_modules\/(?:preact|use-sync-external-store)\//,
            },
            { name: "result", priority: 1, test: /\/src\/shared\/result\.ts$/ },
            // Enums the entry needs to start page requests, kept apart from
            // the rest of the domain (money math, rule engine).
            {
              name: "domain-enums",
              priority: 1,
              test: /\/src\/domain\/(?:chart|finance|query)\.entity\.ts$/,
            },
            // Plain contract enums must not share a chunk with schemas.
            {
              name: "contract-types",
              priority: 1,
              test: /\/src\/contracts\/[^/]+\.types\.ts$/,
            },
          ],
        },
        entryFileNames: "chunks/[name]-[hash].js",
      },
      // Contracts and the domain only declare values at load time. Pages that
      // never parse an input should not download the validator, and a page
      // using one enum should not download the rule engine.
      treeshake: {
        moduleSideEffects: (id) =>
          !(id.includes("/src/contracts/") || id.includes("/src/domain/")),
      },
    },
    target: "es2022",
  },
  plugins: [phosphorWeights(), zodWithoutEval(), copyPortalAssets()],
  // Browsers run Preact's React 19 compatibility layer: a fraction of
  // react-dom's size behind the same API. The Worker still renders HTML with
  // React, and the tests exercise components with React.
  resolve: {
    alias: [
      { find: /^react-dom\/client$/, replacement: "preact/compat/client" },
      {
        find: /^react\/jsx-runtime$/,
        replacement: "preact/compat/jsx-runtime",
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: "preact/compat/jsx-dev-runtime",
      },
      { find: /^react(?:-dom)?$/, replacement: "preact/compat" },
    ],
  },
});
