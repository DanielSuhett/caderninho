import { Document } from "./document";
import { UiLink } from "./ui";

export function notFoundPage() {
  return (
    <Document title="Página não encontrada · Caderninho">
      <main style={{ margin: "80px auto", maxWidth: 640, padding: "0 24px" }}>
        <h1>Página não encontrada.</h1>
        <p>Conheça o Caderninho e instale sua própria cópia na Cloudflare.</p>
        <UiLink href="/">Voltar ao Caderninho</UiLink>
      </main>
    </Document>
  );
}
