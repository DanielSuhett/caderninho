export function DesignHead() {
  return (
    <>
      <script
        async
        src="/theme.js"
      />
      <link
        as="font"
        crossOrigin="anonymous"
        href="/fonts/InterVariable.woff2"
        rel="preload"
        type="font/woff2"
      />
      <link
        href="/kumo.css"
        rel="stylesheet"
      />
      <link
        href="/design.css"
        rel="stylesheet"
      />
    </>
  );
}
