export function DesignHead({
  themeSwitching = true,
}: {
  themeSwitching?: boolean;
}) {
  return (
    <>
      <link
        href="/favicon.ico"
        rel="icon"
        sizes="16x16 32x32"
      />
      <link
        href="/favicon.png"
        rel="icon"
        sizes="96x96"
        type="image/png"
      />
      <link
        href="/apple-touch-icon.png"
        rel="apple-touch-icon"
        sizes="180x180"
      />
      {!!themeSwitching && (
        <script
          async
          src="/theme.js"
        />
      )}
      <link
        as="font"
        crossOrigin="anonymous"
        href="/fonts/Inter-4.001-latin.woff2"
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
