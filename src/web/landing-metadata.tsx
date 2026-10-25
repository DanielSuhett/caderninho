export const landingTitle =
  "Finanças com IA, grátis e de código aberto | Caderninho";
export const landingDescription =
  "Organize contas, cartões e investimentos com ChatGPT e Claude. Caderninho é grátis e de código aberto, para instalar na sua Cloudflare. Explore a demo.";

const siteUrl = "https://usecaderninho.com/";
const socialTitle = "Caderninho · Grátis e de código aberto";
const socialDescription =
  "Organize contas, cartões e investimentos. Use com ChatGPT ou Claude, na sua Cloudflare.";
const imageUrl = `${siteUrl}social-card-open-source-v3.png`;
const imageAlt =
  "Caderninho. Código aberto. De graça. Finanças com ChatGPT e Claude. Na sua Cloudflare, sob licença MIT.";

export function LandingMetadata() {
  return (
    <>
      <link
        href={siteUrl}
        rel="canonical"
      />
      <meta
        content="index,follow,max-image-preview:large"
        name="robots"
      />
      <meta
        content="website"
        property="og:type"
      />
      <meta
        content={siteUrl}
        property="og:url"
      />
      <meta
        content="Caderninho"
        property="og:site_name"
      />
      <meta
        content="pt_BR"
        property="og:locale"
      />
      <meta
        content={socialTitle}
        property="og:title"
      />
      <meta
        content={socialDescription}
        property="og:description"
      />
      <meta
        content={imageUrl}
        property="og:image"
      />
      <meta
        content="image/png"
        property="og:image:type"
      />
      <meta
        content="1200"
        property="og:image:width"
      />
      <meta
        content="630"
        property="og:image:height"
      />
      <meta
        content={imageAlt}
        property="og:image:alt"
      />
      <meta
        content="summary_large_image"
        name="twitter:card"
      />
      <meta
        content={socialTitle}
        name="twitter:title"
      />
      <meta
        content={socialDescription}
        name="twitter:description"
      />
      <meta
        content={imageUrl}
        name="twitter:image"
      />
      <meta
        content={imageAlt}
        name="twitter:image:alt"
      />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@id": `${siteUrl}#website`,
          "@type": "WebSite",
          alternateName: "usecaderninho.com",
          description: landingDescription,
          inLanguage: "pt-BR",
          name: "Caderninho",
          url: siteUrl,
        })}
      </script>
    </>
  );
}
