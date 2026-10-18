import { copyFile, mkdir, writeFile } from "node:fs/promises";

import { renderPage } from "#web/document.tsx";
import { landingPage } from "#web/landing-view.tsx";

// The compiled entry in dist has the same depth as this source in scripts.
const root = new URL("../", import.meta.url);
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
await writeFile(new URL("index.html", output), renderPage(landingPage()));

await writeFile(
  new URL("_headers", output),
  `/*
  Referrer-Policy: same-origin
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
`,
);
