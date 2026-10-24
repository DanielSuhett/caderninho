import type { ReactNode } from "react";

import { Document } from "./document";
import { UiLink } from "./ui";

export function PublicLayout({
  children,
  title,
  description,
  access = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  access?: boolean;
}) {
  return (
    <Document
      head={
        <>
          <meta
            content={description}
            name="description"
          />
          <style>{`
      .public-shell { max-width: 1120px; margin: auto; padding: 0 24px; }
      .public-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; min-height: 80px; }
      .public-brand { font-size: 14px; font-weight: 500; text-decoration: none; color: var(--text); }
      .public-nav { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; }
      .public-skip { position: absolute; top: -100px; left: 16px; padding: 12px; background: var(--surface); }
      .public-skip:focus { top: 8px; }
      .public-kicker, .public-muted, .access-intro { color: var(--muted); }
      .public-actions, .consent-main form { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 24px; }
      .public-surface { padding: 20px 24px; }
      .public-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding-block: 24px; border-top: 1px solid var(--line); color: var(--muted); }
      .access-main { width: 100%; max-width: 480px; margin: 48px auto 72px; }
      .access-main h1 { margin-block: 12px 16px; }
      .access-origin { padding-block: 16px; margin-block: 20px; border-block: 1px solid var(--line); color: var(--muted); }
      .access-origin code { display: block; margin-top: 8px; color: var(--text); overflow-wrap: anywhere; }
      .access-form { display: grid; gap: 20px; }
      .access-main details { margin-top: 24px; }
      .access-help { margin-top: 24px; color: var(--muted); text-align: center; }
      .consent-main { max-width: 720px; margin: 40px auto 64px; }
      .consent-main > p { margin-block: 20px; }
      @media (max-width: 760px) {
        .public-shell { padding-inline: 16px; }
        .public-header { min-height: 72px; gap: 12px; }
        .public-nav { gap: 12px; }
        .public-nav .nav-optional { display: none; }
        .access-main { margin-block: 24px 40px; }
        .public-surface { padding: 16px 20px; }
      }
    `}</style>
        </>
      }
      title={title}
    >
      <div className="public-shell">
        <a
          className="public-skip"
          href="#conteudo"
        >
          Pular para o conteúdo
        </a>
        <header className="public-header">
          <a
            aria-label="Caderninho, início"
            className="public-brand"
            href="/"
          >
            Caderninho
          </a>
          <nav
            aria-label="Navegação principal"
            className="public-nav"
          >
            {access ? (
              <a href="/">Conhecer o produto</a>
            ) : (
              <>
                <a
                  className="nav-optional"
                  href="#como-funciona"
                >
                  Como funciona
                </a>
                <a
                  className="nav-optional"
                  href="https://github.com/DanielSuhett/caderninho"
                >
                  Código
                </a>
                <UiLink
                  href="/account"
                  size="lg"
                  variant="secondary"
                >
                  Entrar
                </UiLink>
              </>
            )}
          </nav>
        </header>
        {children}
        <footer className="public-footer">
          <p>Seus dados na sua Cloudflare.</p>
          <a href="https://github.com/DanielSuhett/caderninho">
            Código aberto no GitHub
          </a>
        </footer>
      </div>
    </Document>
  );
}
