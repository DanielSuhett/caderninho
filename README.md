# Caderninho

Seu MCP financeiro pessoal, instalado na sua conta Cloudflare. Conecte seus bancos
pelo Meu Pluggy e consulte o histórico no ChatGPT ou Claude.

## Começar

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho)

1. **Instale.** Clique no botão e confirme o nome do Worker. Nenhuma senha ou credencial Pluggy é pedida. Mantenha a raiz do repositório, build `npm run build` e deploy `npm run deploy`.
2. **Abra seu acesso privado.** No resultado do deploy na Cloudflare, abra o link de acesso gerado. Copie a chave para seu gerenciador de senhas e clique em Começar. Informe nome/foto e configure Client ID e Client Secret no próprio Caderninho. Autorize cada banco pelo Meu Pluggy; os próximos reutilizam o mesmo acesso. Ao concluir Pessoas, a importação começa e abre Consultar ao terminar.
3. **Conecte seu assistente.** No painel, copie o endereço `/mcp`, adicione-o ao ChatGPT ou Claude com OAuth e confirme a autorização.

Conecte os bancos em [Meu Pluggy](https://meu.pluggy.ai/) antes de importá-los.
O instalador gera uma chave aleatória e guarda somente seu hash como secret
`ADMIN_ACCESS_HASH`. O link privado aparece no log do primeiro deploy; ele contém
a chave, portanto não o compartilhe. Atualizações preservam o acesso existente,
inclusive instalações anteriores com `ADMIN_PASSWORD`. O Client ID e o Client Secret da sua
aplicação no [painel Pluggy](https://dashboard.pluggy.ai/) são validados e guardados
no cofre privado da instalação. Outra pessoa usa o próprio acesso Meu Pluggy;
uma pessoa pode autorizar vários bancos. Instalações que já usam secrets Pluggy
de ambiente continuam funcionando. Consulte [pessoas e bancos](docs/household.md).
Os cenários conferidos e os limites da validação estão em [onboarding](docs/onboarding.md).

O projeto está em pré-produção. `migrations/0001_initial.sql` cria o modelo
completo para um banco novo, incluindo planejamento, pessoas, fotos, histórico
e auditoria. Bases experimentais com schemas anteriores precisam ser recriadas;
não há um caminho de upgrade desses modelos.
O botão usa o código publicado no GitHub; alterações locais não aparecem nele.
O provisionamento completo numa conta Cloudflare nova ainda exige validação real.
O software é gratuito; Cloudflare e Pluggy têm seus próprios limites e custos.

O MCP oferece consultas, sincronização e operações locais de planejamento,
documentadas no [catálogo financeiro](docs/mcp-finance.md). O
[inventário gerado](docs/mcp-tools.md) acompanha os nomes e a contagem do registro. A [paridade com o painel](docs/mcp-finance.md#correspondência-com-o-painel)
inclui prévia de regras, compras parceladas e edição de categorias e grupos.
A importação lê contas, transações,
faturas, investimentos e empréstimos disponíveis na Pluggy. Categorias, tags,
regras, orçamento, metas, recorrências e lançamentos manuais ficam no D1.
A [importação de regras JSON](docs/rule-packs.md) oferece prévia, confirmação e categorias locais na interface; o JSON Brasil fica disponível como exemplo externo.
Edições locais preservam os registros bancários. Escritas exigem confirmação e
chave de idempotência; o MCP não realiza pagamentos bancários.

Consulte o [guia de uso](docs/usage.md) para manutenção e recuperação de acesso.

## Desenvolvimento

Use Node 24, conforme `.nvmrc`, e instale pela raiz:

```sh
npm ci
cp docs/dev.vars.example .dev.vars
npm run migrate:local
npm run dev
```

Antes de iniciar o servidor, preencha `.dev.vars` com valores sintéticos e uma
senha de 16 a 256 caracteres. Os testes usam fixtures e não precisam de contas bancárias.
`npm run build` prepara os assets e o dry-run do Worker; não publica o serviço.

## Site público

A divulgação fica em [usecaderninho.com](https://usecaderninho.com), em um
projeto Cloudflare Pages separado da instalação financeira. O build
`npm run build:portal` também gera `dist/site` com HTML, estilos e fonte, sem
painel, links de entrada, MCP, Functions ou bindings de dados. As referências
das medições ficam em blocos expansíveis.

O projeto Pages `usecaderninho` publica automaticamente os commits da `main`
pelo GitHub. Na configuração de build do Pages, mantenha a raiz do repositório,
comando `npm run build:portal` e diretório de saída `dist/site`. O diretório
`dist` contém também o portal e o pacote do Worker; não é a raiz do site público.

Para republicar somente o site, use `npm run deploy:site` com acesso de escrita
ao Pages. A configuração está em `site/wrangler.jsonc`. Esse comando não
publica o Worker financeiro nem aplica migrações. As cotas mensais mostradas
são equivalentes de 30 dias; os limites Free de D1/KV continuam diários.

[Contribuição e checks](CONTRIBUTING.md) · [Arquitetura](docs/adr-modular-monolith.md) ·
[Identidade visual](DESIGN.md) · [Componentes e layouts](docs/design-system.md)

O projeto usa a [licença MIT](LICENSE); código de terceiros mantém seus avisos.

O [painel da instalação](docs/frontend-workspace.md) reúne visão geral, transações,
[cartões](docs/cards.md), [investimentos](docs/investments.md), regras, grupos,
sincronizações e conexões.

A [Auditoria MCP](docs/mcp-audit.md) mostra autorizações, chamadas, volume e falhas. A galeria autenticada `/account/design-system` demonstra os componentes reais do painel com dados fictícios.
