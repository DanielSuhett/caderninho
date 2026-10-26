import type { ReactNode } from "react";

import { Document } from "./document";
import { ThemeToggle } from "./theme-toggle";
import { UiLink } from "./ui";

export function PublicLayout({
  children,
  title,
  description,
  access = false,
  themeSwitching = true,
}: {
  children: ReactNode;
  title: string;
  description: string;
  access?: boolean;
  themeSwitching?: boolean;
}) {
  return (
    <Document
      head={
        <>
          <meta
            content={description}
            name="description"
          />
          <link
            href="/public.css"
            rel="stylesheet"
          />
        </>
      }
      themeSwitching={themeSwitching}
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
            {!!themeSwitching && <ThemeToggle />}
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
