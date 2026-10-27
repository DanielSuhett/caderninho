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

export function accountPage({ demo = false }: { demo?: boolean } = {}) {
  return (
    <Document
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
      <link
        href="/preload-helper.js"
        rel="modulepreload"
      />
      <link
        href="/account.css"
        rel="stylesheet"
      />
      <div id="account-root">
        <p
          className="account-start"
          role="status"
        >
          {demo
            ? "Abrindo demonstração com dados fictícios…"
            : "Verificando sua instalação…"}
        </p>
      </div>
      <noscript>
        {demo
          ? "Ative JavaScript para explorar a demonstração. Nenhuma conta real é utilizada."
          : "Ative JavaScript para usar o painel. O acesso MCP continua disponível."}
      </noscript>
      <script
        src={demo ? "/demo.js" : "/account.js"}
        type="module"
      />
    </Document>
  );
}
