import type { ReactNode } from "react";

import { Document } from "./document";
import { PublicLayout } from "./public-layout";

export function Portal({ children }: { children: ReactNode }) {
  return (
    <PublicLayout
      access
      description="Autorização da instalação MCP pessoal"
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

export function accountPage() {
  return (
    <Document title="Caderninho · instalação MCP pessoal">
      <link
        href="/account.css"
        rel="stylesheet"
      />
      <div id="account-root">
        <p
          className="account-start"
          role="status"
        >
          Verificando sua instalação…
        </p>
      </div>
      <noscript>
        Ative JavaScript para usar o painel. O acesso MCP continua disponível.
      </noscript>
      <script
        src="/account.js"
        type="module"
      />
    </Document>
  );
}
