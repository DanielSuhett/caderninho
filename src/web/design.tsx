// Approved product identity. Keep DESIGN.md in sync when changing these tokens.
export function DesignHead() {
  return (
    <>
      <link
        rel="preload"
        href="/hanken-grotesk.ttf"
        as="font"
        type="font/ttf"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="/kumo.css"
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
      --page: #000000;
      --surface: #171717;
      --text: #edece8;
      --muted: #adadad;
      --accent: #f6821f;
      --line: #414141;
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
      border: 1px solid var(--line);
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
    }
    :is(button, a).caderninho-primary[data-kumo-component] {
      --text-color-kumo-default: #17100a;
      background: var(--accent);
      border-color: var(--accent);
      color: #17100a;
    }
    :is(button, a).caderninho-primary[data-kumo-component]:hover {
      background: #ff9d4d;
    }
    :is(button, a)[data-kumo-component]:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 5px;
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `}</style>
    </>
  );
}
