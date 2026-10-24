import { colorTokens } from "./design-tokens";

export function DesignHead() {
  return (
    <>
      <link
        href="/kumo.css"
        rel="stylesheet"
      />
      <style>{`
        @layer base {
        :root {
          color-scheme: dark;
          ${Object.entries(colorTokens)
            .map(([name, value]) => `--${name}: ${value};`)
            .join("\n")}
          font-family: var(--font-sans);
          font-size: 16px;
          --text-xs: 14px;
          --text-sm: 14px;
          line-height: 1.5;
          color: var(--text);
          background: var(--page);
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-size: 14px; }
        a { transition: none; text-underline-offset: 3px; }
        h1, h2, h3 { font-weight: 600; line-height: 1.3; }
        h1 { font-size: 28px; }
        h2 { font-size: 20px; }
        h3 { font-size: 16px; }
        p { max-width: 65ch; }
        strong, b { font-weight: 500; }
        small, time { font-size: 14px; }
        code, pre { font-family: ui-monospace, monospace; font-size: .9em; }
        code { overflow-wrap: anywhere; }
        pre { overflow-x: auto; }
        :is(a, button, input, textarea, select, summary):not([data-kumo-component]):focus-visible { outline: 2px solid var(--color-kumo-focus); outline-offset: 3px; }
        ::selection { background: var(--color-kumo-info-tint); }
        .muted, small { color: var(--muted); }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        }
        .feedback { margin-block: 16px; }
        .feedback p { margin-block: 0; }
            `}</style>
    </>
  );
}
