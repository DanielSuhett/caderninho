import assert from "node:assert/strict";
import test from "node:test";

import { renderPage } from "../document";
import { landingPage } from "../landing-view";

const structuredDataPattern =
  /<script type="application\/ld\+json">(.*?)<\/script>/;

test("the public landing preserves its canonical URL, deployment destination and anchors", () => {
  const html = renderPage(landingPage({ publicSite: true }));
  assert.ok(html.includes('href="https://usecaderninho.com/" rel="canonical"'));
  assert.ok(
    html.includes('content="https://usecaderninho.com/" property="og:url"'),
  );
  assert.ok(
    html.includes(
      'href="https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho"',
    ),
  );
  for (const id of ["conteudo", "desempenho", "free-tier"]) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.equal(html.includes('href="/account"'), false);
  assert.ok(renderPage(landingPage()).includes('href="/account"'));
});

test("crawlers receive the social image and search metadata without JavaScript", () => {
  const html = renderPage(landingPage({ publicSite: true }));
  const head = html.slice(0, html.indexOf("</head>"));
  assert.ok(
    head.includes(
      "<title>Finanças com IA, grátis e de código aberto | Caderninho</title>",
    ),
  );
  assert.ok(
    head.includes(
      'content="Caderninho · Grátis e de código aberto" property="og:title"',
    ),
  );
  assert.ok(head.includes('href="/favicon.png" rel="icon" sizes="96x96"'));
  assert.ok(
    head.includes(
      'content="https://usecaderninho.com/social-card-open-source-v3.png" property="og:image"',
    ),
  );
  assert.ok(head.includes('content="1200" property="og:image:width"'));
  assert.ok(head.includes('content="630" property="og:image:height"'));
  assert.ok(head.includes('content="image/png" property="og:image:type"'));
  assert.ok(head.includes('content="pt_BR" property="og:locale"'));
  assert.ok(head.includes('content="Caderninho" property="og:site_name"'));
  assert.ok(head.includes('content="summary_large_image" name="twitter:card"'));
  assert.ok(
    head.includes(
      'content="https://usecaderninho.com/social-card-open-source-v3.png" name="twitter:image"',
    ),
  );
  assert.ok(head.includes('property="og:image:alt"'));
  assert.ok(head.includes('name="twitter:image:alt"'));
  const structuredData = head.match(structuredDataPattern);
  assert.ok(structuredData?.[1]);
  assert.deepEqual(JSON.parse(structuredData[1]), {
    "@context": "https://schema.org",
    "@id": "https://usecaderninho.com/#website",
    "@type": "WebSite",
    alternateName: "usecaderninho.com",
    description:
      "Organize contas, cartões e investimentos com ChatGPT e Claude. Caderninho é grátis e de código aberto, para instalar na sua Cloudflare. Explore a demo.",
    inLanguage: "pt-BR",
    name: "Caderninho",
    url: "https://usecaderninho.com/",
  });
  assert.equal(renderPage(landingPage()).includes('property="og:url"'), false);
  assert.ok(
    renderPage(landingPage()).includes(
      'content="noindex,follow" name="robots"',
    ),
  );
  assert.equal(head.includes("noindex"), false);
});
