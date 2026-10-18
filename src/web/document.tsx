import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DesignHead } from "./design";

export function Document({
  title,
  head,
  children,
}: {
  title: string;
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <html
      data-mode="dark"
      lang="pt-BR"
    >
      <head>
        <meta charSet="utf-8" />
        <meta
          content="width=device-width,initial-scale=1"
          name="viewport"
        />
        <title>{title}</title>
        <DesignHead />
        {head}
      </head>
      <body>{children}</body>
    </html>
  );
}

// Render a complete document once; the account application mounts separately in the browser.
export function renderPage(page: ReactElement) {
  return (
    "<!doctype html>" +
    renderToStaticMarkup(page, { identifierPrefix: "caderninho-" })
  );
}
