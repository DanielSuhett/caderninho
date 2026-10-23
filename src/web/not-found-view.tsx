import { PublicLayout } from "./public-layout";
import { UiLink } from "./ui";

export function notFoundPage() {
  return (
    <PublicLayout
      access
      description="A página solicitada não foi encontrada nesta instalação do Caderninho."
      title="Página não encontrada · Caderninho"
    >
      <main
        className="access-main"
        id="conteudo"
        tabIndex={-1}
      >
        <h1>Página não encontrada.</h1>
        <p className="access-intro">
          Conheça o Caderninho e instale sua própria cópia na Cloudflare.
        </p>
        <div className="public-actions">
          <UiLink href="/">Voltar ao Caderninho</UiLink>
        </div>
      </main>
    </PublicLayout>
  );
}
