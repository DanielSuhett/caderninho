export function DesignHead({
  themeSwitching = true,
  stylesheets = ["/kumo.css", "/design.css"],
}: {
  themeSwitching?: boolean;
  // Build-generated pages pass content-hashed copies that never revalidate.
  stylesheets?: string[];
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
      {stylesheets.map((href) => (
        <link
          href={href}
          key={href}
          rel="stylesheet"
        />
      ))}
    </>
  );
}
