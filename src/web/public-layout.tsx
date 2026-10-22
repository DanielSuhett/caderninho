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
      .public-shell { max-width: 1168px; margin: auto; padding: 0 24px; font-size: 16px; }
      .public-shell h1, .public-shell h2, .public-shell h3, .public-shell p { margin: 0; }
      .public-shell h1 { font-weight: 600; letter-spacing: -.045em; line-height: 1.08; }
      .public-shell h2 { font-size: 28px; font-weight: 550; letter-spacing: -.025em; line-height: 1.25; }
      .public-shell h3 { font-size: 18px; font-weight: 550; line-height: 1.4; }
      .public-shell p { max-width: 62ch; }
      .public-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; min-height: 88px; }
      .public-brand { font-size: 29px; font-weight: 650; letter-spacing: -.055em; text-decoration: none; }
      .public-nav { display: flex; gap: 24px; align-items: center; font-size: 14px; }
      .public-nav a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; }
      .public-nav a:not([data-kumo-component]):hover { color: var(--accent); }
      .public-shell :is(button,a)[data-kumo-component] { min-height: 44px; padding: 10px 18px; font-size: 14px; transition: transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease; }
      .public-shell :is(button,a)[data-kumo-component]:not(:disabled):hover { transform: translateY(-1px); box-shadow: var(--shadow-low); }
      .public-shell :is(button,a)[data-kumo-component]:active { transform: translateY(0); }
      .public-skip { position: absolute; top: -100px; left: 16px; z-index: 3; padding: 12px; background: var(--surface); }
      .public-skip:focus { top: 8px; }
      .public-kicker { font-size: 12px; color: var(--muted); }
      .public-muted { color: var(--muted); }
      .public-actions { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-top: 28px; }
      .public-actions > a:not([data-kumo-component]) { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; }
      .public-shell .public-note { margin-top: 16px; font-size: 12px; color: var(--muted); }
      .public-surface { min-width: 0; padding: 28px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow-public); }
      .landing-hero { display: grid; grid-template-columns: 1.25fr 1fr; gap: 48px; align-items: center; padding: 64px 0 72px; }
      .landing-hero h1 { margin-block: 16px 24px; font-size: clamp(36px,5vw,64px); text-wrap: balance; }
      .landing-intro { color: var(--muted); font-size: 17px; line-height: 1.6; }
      .public-example { margin: 0; }
      .public-example figcaption { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--muted); }
      .public-example h2 { margin-top: 28px; font-size: 20px; }
      .public-example .example-period { margin-top: 8px; font-size: 12px; color: var(--muted); }
      .example-values { margin: 24px 0 0; }
      .example-values > div { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--line); }
      .example-values dt { color: var(--muted); font-size: 14px; }
      .example-values dd { margin: 0; font-size: 16px; font-weight: 550; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .public-example footer { padding-top: 16px; margin-top: 8px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
      .landing-how, .landing-faq { padding: 40px 0; border-top: 1px solid var(--line); scroll-margin-top: 24px; }
      .landing-how > p { margin-top: 12px; color: var(--muted); }
      .public-steps { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 32px; padding: 0; margin: 32px 0 0; list-style: none; counter-reset: steps; }
      .public-steps li { counter-increment: steps; min-width: 0; }
      .public-steps li::before { content: "0" counter(steps); display: block; margin-bottom: 12px; font-size: 12px; color: var(--accent); font-variant-numeric: tabular-nums; }
      .public-steps p { margin-top: 8px; font-size: 14px; color: var(--muted); }
      .landing-faq { display: grid; grid-template-columns: 1fr 2fr; gap: 48px; }
      .public-shell details { border-bottom: 1px solid var(--line); }
      .public-shell summary { min-height: 44px; padding-block: 12px; cursor: pointer; font-size: 15px; font-weight: 550; }
      .public-shell details p { margin-block: 8px 20px; font-size: 14px; color: var(--muted); }
      .public-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 24px 0; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
      .public-footer a { display: inline-flex; align-items: center; min-height: 44px; }
      .access-main { width: 100%; max-width: 440px; margin: 48px auto 72px; }
      .access-main .public-surface { animation: public-shadow-in 400ms ease both; }
      @keyframes public-shadow-in { from { box-shadow: none; } to { box-shadow: var(--shadow-public); } }
      .access-main h1 { margin-block: 12px 16px; font-size: 32px; }
      .access-intro { color: var(--muted); font-size: 14px; }
      .access-origin { padding-block: 20px; margin-block: 20px; border-block: 1px solid var(--line); font-size: 12px; color: var(--muted); }
      .access-origin code { display: block; margin-top: 6px; font-size: 13px; color: var(--text); overflow-wrap: anywhere; }
      .access-form { display: grid; gap: 20px; }
      .access-form label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 550; }
      .access-form input:not([type="hidden"]) { display: block; width: 100%; min-height: 48px; padding: 12px; font: inherit; background: var(--page); color: var(--text); border: 1px solid var(--control-border); border-radius: 6px; }
      .access-form input[aria-invalid="true"] { border-color: var(--error-border); }
      .access-form button { width: 100%; justify-content: center; text-align: center; }
      .access-error { padding: 12px 14px; margin-bottom: 20px; border: 1px solid var(--error-border); border-left-width: 3px; border-radius: 6px; color: var(--error-text); background: var(--error-bg); font-size: 14px; }
      .access-main details { margin-top: 24px; border-top: 1px solid var(--line); border-bottom: 0; }
      .access-main .access-help { margin-top: 20px; font-size: 12px; color: var(--muted); text-align: center; }
      .public-reveal { animation: public-enter 400ms cubic-bezier(.2,.7,.2,1) both; }
      .public-reveal-delayed { animation-delay: 80ms; }
      @keyframes public-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .public-reveal, .access-main .public-surface { animation: none; } .public-shell :is(button,a)[data-kumo-component] { transition: none; } .public-shell :is(button,a)[data-kumo-component]:not(:disabled):hover { transform: none; } }
      @media (max-width: 760px) {
        .public-shell { padding-inline: 20px; }
        .public-header { min-height: 80px; gap: 12px; }
        .public-nav { gap: 12px; }
        .public-nav .nav-optional { display: none; }
        .landing-hero { grid-template-columns: 1fr; gap: 32px; padding: 36px 0 40px; }
        .landing-hero h1 { max-width: 20ch; font-size: clamp(36px,7vw,48px); margin-bottom: 20px; }
        .landing-intro { font-size: 16px; }
        .public-actions { gap: 8px 20px; margin-top: 24px; }
        .public-surface { padding: 24px; }
        .public-steps { grid-template-columns: 1fr; gap: 24px; }
        .landing-faq { grid-template-columns: 1fr; gap: 24px; }
        .public-steps li::before { margin-bottom: 4px; }
        .public-shell h2 { font-size: 24px; }
        .public-example h2 { font-size: 20px; }
        .access-main { margin-block: 32px 48px; }
        .access-main h1 { font-size: 28px; }
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
            caderninho.
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
