import { colorTokens, shadowTokens } from "./design-tokens";

// Approved product identity. Keep DESIGN.md in sync when changing these tokens.
export function DesignHead() {
  return (
    <>
      <link
        as="font"
        crossOrigin="anonymous"
        href="/hanken-grotesk.ttf"
        rel="preload"
        type="font/ttf"
      />
      <link
        href="/kumo.css"
        rel="stylesheet"
      />
      <style>{`
    @font-face {
      font-family: Hanken;
      src: url("/hanken-grotesk.ttf") format("truetype");
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    :root {
      color-scheme: dark;
      ${Object.entries({ ...colorTokens, ...shadowTokens })
        .map(([name, value]) => `--${name}: ${value};`)
        .join("\n")}
      --color-kumo-brand: var(--accent);
      --color-kumo-link: var(--accent);
      --color-kumo-focus: var(--accent);
      font-family: Hanken, sans-serif;
      font-size: 17px;
      line-height: 1.55;
      color: var(--text);
      background: var(--page);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
    }
    a {
      color: inherit;
      text-underline-offset: 5px;
    }
    :is(a, button, input, textarea, summary):focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 5px;
    }
    :is(button, a)[data-kumo-component] {
      min-height: 48px;
      height: auto;
      padding: 12px 24px;
      max-width: 100%;
      border: 1px solid var(--control-border);
      border-radius: 6px;
      box-shadow: none;
      background: var(--surface);
      color: var(--text);
      background-image: none;
      font:
        550 16px Hanken,
        sans-serif;
      text-decoration: none;
      white-space: normal;
      cursor: pointer;
      transition: background-color 150ms ease, border-color 150ms ease;
    }
    :is(button, a)[data-kumo-component]:not(:disabled):is(:hover, [data-preview-state="hover"]) {
      background: var(--surface-hover);
    }
    :is(button, a)[data-kumo-component]:not(:disabled):is(:active, [data-preview-state="pressed"]) {
      background: var(--surface-pressed);
    }
    :is(button, a).caderninho-primary[data-kumo-component] {
      --text-color-kumo-default: var(--on-accent);
      background: var(--accent);
      border-color: var(--accent);
      color: var(--on-accent);
    }
    :is(button, a).caderninho-primary[data-kumo-component]:not(:disabled):is(:hover, [data-preview-state="hover"]) {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    :is(button, a).caderninho-primary[data-kumo-component]:not(:disabled):is(:active, [data-preview-state="pressed"]) {
      background: var(--accent-pressed);
      border-color: var(--accent-pressed);
    }
    button.caderninho-danger[data-kumo-component] {
      color: var(--error-text);
      background: var(--error-bg);
      border-color: var(--error-border);
    }
    button.caderninho-danger[data-kumo-component]:not(:disabled):is(:hover, [data-preview-state="hover"]) {
      background: var(--danger-hover);
    }
    button.caderninho-danger[data-kumo-component]:not(:disabled):is(:active, [data-preview-state="pressed"]) {
      background: var(--danger-pressed);
    }
    :is(button, a)[data-kumo-component]:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 5px;
    }
    :is(button.caderninho-primary, button.caderninho-danger, button)[data-kumo-component]:disabled {
      opacity: 1;
      color: var(--disabled-text);
      background: var(--disabled-bg);
      border-color: var(--line);
      box-shadow: none;
      transform: none;
      cursor: not-allowed;
    }
    :is(input, select, textarea) { accent-color: var(--accent); }
    :is(input, textarea)::placeholder { color: var(--muted); opacity: 1; }
    :is(input, select, textarea)[aria-invalid="true"] { border-color: var(--error-border); }
    ::selection { background: var(--selected-bg); color: var(--selected-text); }
    .notice, .status-label, .sync-state {
      --tone-text: var(--info-text);
      --tone-bg: var(--info-bg);
      --tone-border: var(--info-border);
      color: var(--tone-text);
      background: var(--tone-bg);
      border-color: var(--tone-border);
    }
    [data-tone="success"], .run-succeeded, .sync-succeeded {
      --tone-text: var(--success-text); --tone-bg: var(--success-bg); --tone-border: var(--success-border);
    }
    [data-tone="warning"], .run-pending, .sync-pending {
      --tone-text: var(--warning-text); --tone-bg: var(--warning-bg); --tone-border: var(--warning-border);
    }
    [data-tone="error"], .run-failed, .sync-failed {
      --tone-text: var(--error-text); --tone-bg: var(--error-bg); --tone-border: var(--error-border);
    }
    [data-tone="neutral"] {
      --tone-text: var(--muted); --tone-bg: var(--surface); --tone-border: var(--line);
    }
    .notice { padding: 16px; border: 1px solid var(--tone-border); border-left-width: 3px; border-radius: 6px; }
    .notice a:not([data-kumo-component]) { color: inherit; }
    .notice p { color: inherit; }
    @media (prefers-reduced-motion: reduce) { :is(button, a)[data-kumo-component] { transition: none; } }
  `}</style>
    </>
  );
}
