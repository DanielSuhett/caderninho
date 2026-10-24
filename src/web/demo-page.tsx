import { Document } from "./document";

export function demoPage() {
  return (
    <Document title="Demonstração · Caderninho">
      <meta
        content="noindex"
        name="robots"
      />
      <link
        href="/account.css"
        rel="stylesheet"
      />
      <div id="demo-root">
        <p
          className="account-start"
          role="status"
        >
          Abrindo demonstração com dados fictícios…
        </p>
      </div>
      <noscript>
        Ative JavaScript para explorar a demonstração. Nenhuma conta real é
        utilizada.
      </noscript>
      <script
        src="/demo.js"
        type="module"
      />
    </Document>
  );
}
