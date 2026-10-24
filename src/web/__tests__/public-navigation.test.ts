import assert from "node:assert/strict";
import test from "node:test";

import { renderPage } from "../document";
import { landingPage } from "../landing-view";

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
