import type { ReactNode } from "react";

import { Document } from "./document";
import { PublicLayout } from "./public-layout";

export function Portal({ children }: { children: ReactNode }) {
  return (
    <PublicLayout
      access
      description="Autorização da instalação MCP pessoal"
      themeSwitching={false}
      title="Caderninho · instalação MCP pessoal"
    >
      <main
        className="consent-main"
        id="conteudo"
      >
        {children}
      </main>
    </PublicLayout>
  );
}

export interface AccountAssets {
  account: string;
  script: string;
  stylesheets: string[];
}

export function accountPage({
  demo = false,
  preload = [],
  assets,
}: {
  demo?: boolean;
  // Built chunk paths for this route; the browser fetches them in parallel
  // with the entry instead of one round trip later.
  preload?: string[];
  // Content-hashed entry and styles; without them the stable names load.
  assets?: AccountAssets;
} = {}) {
  return (
    <Document
      {...(assets && { stylesheets: assets.stylesheets })}
      title={
        demo
          ? "Demonstração · Caderninho"
          : "Caderninho · instalação MCP pessoal"
      }
    >
      {!!demo && (
        <meta
          content="noindex"
          name="robots"
        />
      )}
      {preload.map((path) => (
        <link
          href={`/${path}`}
          key={path}
          rel="modulepreload"
        />
      ))}
      <link
        href={assets?.account ?? "/account.css"}
        rel="stylesheet"
      />
      <div id="account-root">
        <div
          className="account-start account-boot"
          role="status"
        >
          <p>
            {demo
              ? "Abrindo demonstração com dados fictícios…"
              : "Verificando sua instalação…"}
          </p>
          <span
            aria-hidden="true"
            className="account-boot-progress"
          />
        </div>
      </div>
      <noscript>
        {demo
          ? "Ative JavaScript para explorar a demonstração. Nenhuma conta real é utilizada."
          : "Ative JavaScript para usar o painel. O acesso MCP continua disponível."}
      </noscript>
      <script
        src={assets?.script ?? (demo ? "/demo.js" : "/account.js")}
        type="module"
      />
    </Document>
  );
}
