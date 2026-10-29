import type { IncomingMessage, ServerResponse } from "node:http";

import { createServer, type Plugin } from "vite";

import { tryCatch } from "../src/shared/result";

// Front-end local com HMR sobre uma instalação já publicada: o Vite serve o
// código do portal e encaminha HTML, /api e arquivos para REMOTE_URL. Nenhum
// Worker roda localmente; leituras e escritas são as da instalação remota.
const REMOTE_URL = new URL(
  process.env.REMOTE_URL ?? "https://meumcp.caderninho-web.workers.dev",
);
const VITE_PORT = 5173;
// Generated and local-only trees hold tens of thousands of files; watching them
// grows the dev server past the Node heap.
const unwatched = [
  "**/.agents/**",
  "**/.claude/**",
  "**/.localdocs/**",
  "**/.taste-skill/**",
  "**/.wrangler/**",
  "**/dist/**",
  "**/outputs/**",
  "**/work/**",
];

// The account shell ships built chunks. In development those are replaced by
// the source entry, so the page loads one copy of each module through Vite.
const builtAccountScript =
  /<script src="\/chunks\/account-[^"]*" type="module">[\s\S]*?<\/script>/;
const builtPreload = /<link href="\/chunks\/[^"]*" rel="modulepreload"\/>/g;
// Kumo's built stylesheet is purged against the deployed bundles, so classes
// new local code uses would be missing. Development loads the full library
// styles and the local design tokens instead.
const builtAppStyle =
  /<link href="\/chunks\/(?:account|design|kumo)-[^"]*\.css" rel="stylesheet"\/>/g;
const devStyles = "virtual:dev-styles";
const devStylesId = `\0${devStyles}`;
const hopByHop = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "strict-transport-security",
  "transfer-encoding",
]);

// __Host- cookies require Secure, which browsers only accept over HTTPS or on
// localhost. Over plain HTTP on the LAN they are renamed and sent without
// Secure, and renamed back before reaching the installation.
const hostCookiePrefix = "__Host-";
const devCookiePrefix = "dev-host-";
const secureAttribute = /;\s*Secure/i;

function toDevCookie(cookie: string) {
  if (!cookie.startsWith(hostCookiePrefix)) {
    return cookie;
  }
  return (
    devCookiePrefix +
    cookie.slice(hostCookiePrefix.length).replace(secureAttribute, "")
  );
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Uint8Array.from(Buffer.concat(chunks));
}

function rewriteAccountShell(html: string) {
  if (!html.includes('src="/chunks/account-')) {
    return html;
  }
  return html
    .replace(builtAccountScript, "")
    .replace(builtPreload, "")
    .replace(builtAppStyle, "")
    .replace(
      "</body>",
      '<script type="module" src="/@vite/client"></script>' +
        `<script type="module" src="/@id/__x00__${devStyles}"></script>` +
        '<script type="module" src="/src/web/account-entry.ts"></script></body>',
    );
}

async function forward(request: IncomingMessage, response: ServerResponse) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || name === "host" || name === "accept-encoding") {
      continue;
    }
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const cookie = headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie.replaceAll(devCookiePrefix, hostCookiePrefix));
  }
  // The login compares Origin with the installation's own origin.
  if (headers.has("origin")) {
    headers.set("origin", REMOTE_URL.origin);
  }

  const method = request.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const { data: upstream, error } = await tryCatch(
    fetch(new URL(request.url ?? "/", REMOTE_URL), {
      headers,
      method,
      redirect: "manual",
      ...(hasBody && { body: await readBody(request) }),
    }),
  );
  if (error) {
    response.statusCode = 502;
    response.end(`Sem resposta de ${REMOTE_URL.origin}: ${error.message}`);
    return;
  }

  const { data: bytes, error: readError } = await tryCatch(
    upstream.arrayBuffer(),
  );
  if (readError) {
    response.statusCode = 502;
    response.end(`Falha ao ler a resposta de ${REMOTE_URL.origin}.`);
    return;
  }

  const isHtml = upstream.headers.get("content-type")?.startsWith("text/html");
  const payload = isHtml
    ? Buffer.from(rewriteAccountShell(Buffer.from(bytes).toString("utf8")))
    : Buffer.from(bytes);

  response.statusCode = upstream.status;
  upstream.headers.forEach((value, name) => {
    if (hopByHop.has(name) || name === "set-cookie") {
      return;
    }
    response.setHeader(name, value);
  });
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) {
    response.setHeader("set-cookie", cookies.map(toDevCookie));
  }
  response.setHeader("content-length", payload.length);
  response.end(payload);
}

function remoteInstallation(): Plugin {
  return {
    configureServer(server) {
      // Returned hook runs after Vite's own middleware, so only requests Vite
      // does not serve (HTML, API, public files) reach the installation.
      return () => {
        server.middlewares.use(async (request, response) => {
          const { error } = await tryCatch(forward(request, response));
          if (error) {
            response.statusCode = 502;
            response.end(error.message);
          }
        });
      };
    },
    load(id) {
      if (id === devStylesId) {
        return 'import "@cloudflare/kumo/styles/standalone";\nimport "/src/web/styles/design.css";';
      }
    },
    name: "remote-installation-proxy",
    resolveId(id) {
      if (id === devStyles) {
        return devStylesId;
      }
    },
  };
}

const vite = await createServer({
  appType: "custom",
  plugins: [remoteInstallation()],
  server: {
    host: process.env.DEV_HOST ?? "localhost",
    port: VITE_PORT,
    strictPort: true,
    watch: { ignored: unwatched },
  },
});
await vite.listen();
vite.printUrls();
