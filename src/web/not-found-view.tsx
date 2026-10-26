import { PublicLayout } from "./public-layout";
import { UiLink } from "./ui";

export function notFoundPage() {
  return (
    <PublicLayout
      access
      description="A página solicitada não foi encontrada no Caderninho."
      title="Página não encontrada · Caderninho"
    >
      <main
        className="access-main"
        id="conteudo"
        tabIndex={-1}
      >
        <h1>Página não encontrada</h1>
        <p className="access-intro">Volte ao início para continuar.</p>
        <div className="public-actions">
          <UiLink
            href="/"
            size="lg"
            variant="secondary"
          >
            Voltar ao início
          </UiLink>
        </div>
      </main>
    </PublicLayout>
  );
}
