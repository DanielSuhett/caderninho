import type { ReactNode } from "react";

import { Document } from "./document";

export function Portal({ children }: { children: ReactNode }) {
  return (
    <Document
      head={
        <style>{`
          pre {
            max-width: 100%;
            overflow-x: auto;
            padding: 16px;
            background: var(--surface);
          }
          textarea {
            display: block;
            width: 100%;
            min-height: 150px;
            resize: vertical;
            padding: 12px;
            font: inherit;
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--muted);
            border-radius: 4px;
          }
          details {
            border-top: 1px solid var(--line);
            padding: 20px 0;
            margin-top: 20px;
          }
          summary {
            min-height: 44px;
            cursor: pointer;
            font-weight: 600;
          }
          button:disabled {
            opacity: 0.65;
            cursor: wait;
          }
          small {
            color: var(--muted);
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
          }
          main {
            isolation: isolate;
            max-width: 850px;
            margin: auto;
            padding: 40px 24px 72px;

            min-height: 100vh;
          }
          nav {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 64px;
          }
          nav a {
            color: var(--text);
            font-weight: 650;
            text-decoration: none;
            letter-spacing: -0.04em;
            font-size: 29px;
          }
          nav span {
            color: var(--muted);
            font-size: 14px;
            align-self: center;
          }
          h1 {
            font-family: Hanken, sans-serif;
            font-weight: 600;
            font-size: clamp(34px, 6vw, 58px);
            line-height: 1.08;
            letter-spacing: -0.045em;
            max-width: 720px;
            margin: 16px 0 24px;
          }
          h2 {
            font-size: 26px;
            font-weight: 550;
            letter-spacing: -0.03em;
          }
          p {
            max-width: 66ch;
          }
          .eyebrow {
            color: var(--accent);
            font-weight: 650;
            font-size: 14px;
          }
          section {
            border-top: 1px solid var(--line);
            margin-top: 36px;
            padding-top: 20px;
          }
          a {
            color: var(--accent);
            text-decoration: underline;
            text-underline-offset: 3px;
          }
          a[data-kumo-component] {
            text-decoration: none;
          }
          [data-kumo-component="Button"],
          [data-kumo-component="LinkButton"] {
            display: inline-flex;
            min-height: 44px;
            height: auto;
            max-width: 100%;
            white-space: normal;
            text-align: left;
            padding-block: 10px;
            margin: 6px 4px 6px 0;
          }
          .field {
            margin: 20px 0 12px;
          }
          .field input {
            width: 100%;
            min-height: 48px;
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--line);
            border-radius: 6px;
            box-shadow: none;
          }
          label {
            display: block;
            font-weight: 600;
          }
          p {
            margin: 16px 0;
          }
          h2 {
            margin: 12px 0;
          }
          ol,
          ul {
            padding-left: 24px;
            margin: 16px 0;
          }
          ol {
            list-style: decimal;
          }
          ul {
            list-style: disc;
          }
          li {
            margin-block: 8px;
          }
          input:read-only {
            font-family: ui-monospace, monospace;
            font-size: 14px;
          }
          code {
            overflow-wrap: anywhere;
            font-size: 14px;
          }
          .notice {
            background: var(--surface);
            border-left: 3px solid var(--accent);
            padding: 16px;
          }
          form + form {
            margin-top: 16px;
          }
          time {
            font-size: 14px;
          }
          a:focus-visible,
          button:focus-visible,
          input:focus-visible {
            outline: 3px solid var(--accent);
            outline-offset: 4px;
          }
          footer {
            border-top: 1px solid var(--line);
            padding-top: 24px;
            margin-top: 56px;
            color: var(--muted);
            font-size: 14px;
          }
          @media (max-width: 480px) {
            main {
              isolation: isolate;
              padding: 24px 18px 48px;
            }
            nav {
              margin-bottom: 40px;
            }
            nav span {
              max-width: 110px;
            }
          }
        `}</style>
      }
      title="Caderninho · instalação MCP pessoal"
    >
      <main>
        <nav aria-label="Navegação principal">
          <a href="/">caderninho.</a>
          <span>MCP financeiro pessoal</span>
        </nav>
        {children}
        <footer>
          Seus dados na sua Cloudflare. Acesso controlado por você.
        </footer>
      </main>
    </Document>
  );
}

export function accountPage() {
  return (
    <Portal>
      <div id="account-root">
        <p role="status">Verificando sua instalação…</p>
      </div>
      <noscript>
        Ative JavaScript para usar o painel. O acesso MCP continua disponível.
      </noscript>
      <link
        href="/account.css"
        rel="stylesheet"
      />
      <script
        src="/account.js"
        type="module"
      />
    </Portal>
  );
}
