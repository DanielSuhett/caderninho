# SEO da landing

Revisão de 25/10/2026 para `https://usecaderninho.com/`. Público: quem quer
organizar finanças pessoais na própria Cloudflare e consultar pelo ChatGPT,
Claude ou outro cliente MCP. Objetivo: entender o produto, explorar a demo e
instalar. Não há dados de Search Console ou volume de palavras-chave nesta
revisão; a intenção de busca é uma hipótese editorial, não demanda comprovada.

## Correções locais

| Prioridade | Evidência | Mudança |
| --- | --- | --- |
| Alta | Abertura falava de bancos e IA sem nomear a categoria do produto | Categoria e recursos concretos no hero; FAQ explica produto e requisitos |
| Alta | A mesma landing é distribuída em instalações pessoais | Somente o site público anuncia canonical e indexação; a landing instalada usa `noindex,follow` |
| Média | Favicon público retornou 404 | ICO 16/32 px, PNG 96 px e ícone Apple 180 px, derivados da mesma arte Inter/azul Kumo |
| Média | Textos de 20/22 px no card viravam 6/7 px numa prévia de 360 px | Rodapé simplificado e textos principais de apoio em 32/34 px |
| Média | Título genérico servia tanto à busca quanto ao compartilhamento | Busca descreve finanças no ChatGPT/Claude; redes mantêm a frase da marca |

Metadados e JSON-LD são renderizados no HTML inicial. O `WebSite` usa nome,
nome alternativo pelo domínio e identificador estável; não contém avaliações
inventadas. A demo continua fora da indexação e fora do sitemap. O sitemap
contém apenas a landing canônica, sem datas de atualização artificiais.

## Pendências externas

Em 25/10, consultas HTTP confirmaram: HTTP redireciona para HTTPS;
`/index.html` redireciona para `/`; uma rota inexistente retorna 404; robots e
sitemap retornam 200. O domínio `usecaderninho.pages.dev` ainda retorna 200 com
a cópia da landing, e `www.usecaderninho.com` não resolve em DNS.

A consolidação do domínio exige configurar os redirecionamentos remotos na
Cloudflare. Para `pages.dev`, a documentação recomenda Bulk Redirects; regras
de domínio não são suportadas pelo arquivo `_redirects` do Pages. Preservar
caminho e query string. `www` precisa primeiro de DNS/TLS para poder redirecionar.
Essas alterações de infraestrutura e o deploy não fazem parte da validação local.

Após publicar, inspecionar a URL e enviar o sitemap no Search Console; verificar
indexação/canonical escolhido, impressões e cliques antes de atribuir ganho ao
SEO. Revalidar acesso anônimo às imagens, MIME, tamanho e status com user agents
de crawlers. Testar o link no OpenGraph.xyz e em clientes reais de WhatsApp e X;
aprovação de um simulador não comprova o comportamento dos aplicativos. Ao trocar
uma imagem já publicada, usar uma nova URL de imagem e solicitar nova coleta
onde houver depurador, sem prometer invalidação dos caches de terceiros.

## Revisão crítica da versão pública no GPT Sites

Versão 3 publicada em 25/10/2026 no mesmo endereço:
https://caderninho-landing-lab.youngearth32.chatgpt.site/.
Commit da fonte Sites: `b73f569b34852ef18cf6833f316fe8dbb9287f45`.
Acesso confirmado como `public`, com HTTP sem cookies/autenticação. A cópia
continua `noindex,follow,max-image-preview:large`, para iteração pública sem
concorrer com o domínio principal nas buscas.

| Prioridade | Problema observado na versão 2 | Correção na versão 3 |
| --- | --- | --- |
| Alta | “Código aberto” era uma nota pequena; “grátis” não aparecia no título ou na arte | Hero “Código aberto. De graça.”; categoria explícita e link GitHub/MIT |
| Alta | A primeira ação exigia instalar infraestrutura; a segunda levava ao benchmark técnico | Demo como ação principal; instalação secundária; dados fictícios e ausência de cadastro explícitos |
| Alta | Gratuidade do software e limites dos serviços se confundiam | Linha Caderninho grátis; Cloudflare/Pluggy/IA separados; validação do Free visível fora do disclosure |
| Média | Custos apareciam depois de comparação, conexão e regras | Custos antes das seções técnicas, com âncora direta perto do CTA |
| Média | Card não destacava gratuidade e detalhes sumiam na miniatura do LinkedIn | Arte central com duas mensagens principais, 1200×630, PNG de 51.581 bytes e URL nova |

Capturas antes e depois em `outputs/seo/public-audit/`, abertas e inspecionadas.
Desktop público em 1440×900; celular em 360×800 e configuração 390×844
(`innerWidth` 391 nesta sessão). Sem overflow horizontal nas duas larguras
móveis verificadas; CTAs com 44 px de altura. A demo foi aberta pelo CTA e chegou
à visão geral com dados fictícios. Isso não equivale a testar aparelhos físicos,
Safari, todas as interações ou acessibilidade completa.

OpenGraph.xyz recolheu a imagem nova e exibiu as prévias de Facebook, X,
LinkedIn, WhatsApp e Discord: zero erros, 12 verificações boas e um aviso de
“missing conversion text”. Esse aviso sugere CTA dentro da arte; é uma
recomendação de conversão, não falha de metadados. A mensagem principal foi
priorizada sem adicionar um botão fictício. A miniatura do LinkedIn preserva
“Código aberto” e “De graça”; textos de apoio continuam pequenos nesse formato.
Não houve envio real pelos aplicativos nem invalidação dos caches deles.

HTTP anônimo e requisições com user agents de Facebook, X e WhatsApp receberam
200 e metadados únicos com a URL nova. A imagem respondeu `image/png`, 1200×630.
Essas requisições simulam agentes; não comprovam visita dos crawlers reais.

`mise run check` passou: 97 testes unitários, 166 de integração, build e runtime
Worker. Após o ajuste final exclusivamente CSS dos alvos de toque, `check:quick`
e `build:portal` passaram novamente. Fontes principais, demo e metadados
foram publicados juntos pelo fluxo Sites. Nenhum deploy Cloudflare do domínio
principal foi feito nesta revisão.

## Decisões críticas e fontes

A skill [seo-audit](https://github.com/coreyhaines31/marketingskills/blob/main/skills/seo-audit/SKILL.md)
foi consultada como roteiro, sem instalar scripts externos. Comprimentos de título
e descrição foram tratados como referências de legibilidade, não limites rígidos:
o Google pode truncar títulos por largura e selecionar outro trecho da página.
[Títulos](https://developers.google.com/search/docs/appearance/title-link) e
[snippets](https://developers.google.com/search/docs/appearance/snippet).

Os relatos no [Reddit sobre WhatsApp](https://www.reddit.com/r/nextjs/comments/1kx2nao/open_graph_not_loading_on_whatsapp/)
motivaram conferir entrega e acesso anônimo, sem adotar diagnósticos de terceiros
como causa deste site. O [checklist da comunidade](https://www.reddit.com/r/WebsiteSEO/comments/1qv4tp3/whats_your_every_website_needs_this_seo_checklist/)
foi confrontado com as fontes primárias abaixo.

Não adicionar `llms.txt` para tentar subir no Google: a
[orientação oficial](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
diz que o arquivo não melhora sua visibilidade ali. Manter perguntas úteis no
conteúdo, sem marcar FAQ apenas para buscar um resultado enriquecido: esse
recurso foi [descontinuado em maio de 2026](https://developers.google.com/search/updates).
Também não fabricar reviews para completar os requisitos de
[SoftwareApplication](https://developers.google.com/search/docs/appearance/structured-data/software-app).

Referências de implementação: [nome do site](https://developers.google.com/search/docs/appearance/site-names),
[favicon](https://developers.google.com/search/docs/appearance/favicon-in-search),
[Open Graph](https://ogp.me/),
[redirecionamento Pages](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/).

## Artes e verificação

As fontes editáveis ficam em `src/web/assets/social-card.svg` e
`src/web/assets/favicon.svg`. Exportar com Inter Variable, usando a fonte local
do produto, sem depender de fontes remotas. Manter o PNG social em 1200 × 630;
exportar o favicon em 96 × 96, o ícone Apple em 180 × 180 e o ICO em 16/32 px.
Os arquivos em `public/` são copiados para os dois builds.

Executar `mise run check` e verificar a saída servida pelo runtime local, não
apenas o código-fonte: metadados únicos no head, JSON-LD parseável, imagens com
MIME/dimensões corretos, canonical público e noindex das cópias pessoais/demo.
O teste não mede posição no Google, Core Web Vitals de usuários reais nem
compartilhamento em hosts reais.

Nesta revisão, `mise run check` passou com 97 testes unitários, 166 de integração,
build e runtime do Worker. A prévia estática respondeu em localhost e LAN para
quatro user agents, com metadados únicos, JSON-LD parseável, dimensões/MIME das
imagens e políticas de indexação conferidos. Esses user agents simulam a
requisição; não são visitas reais dos crawlers. O teste adicional com
`wrangler pages dev` herdou os bindings do Worker e falhou por `FinanceWorkflow`
ausente. Após três tentativas, a checagem foi interrompida: não há prova de
headers/comportamento do Pages novo até validar em um ambiente corretamente isolado
ou após publicação autorizada.
