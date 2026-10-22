# Caderninho

Seu MCP financeiro pessoal, instalado na sua conta Cloudflare. Conecte seus bancos
pelo Meu Pluggy e consulte o histórico no ChatGPT ou Claude.

## Começar

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho)

1. **Instale.** Clique no botão, confirme o nome do Worker e informe os três campos abaixo. Mantenha a raiz do repositório, build `npm run build` e deploy `npm run deploy`.
2. **Conecte seus bancos.** Abra `/account`, entre com sua senha e use **Conectar Meu Pluggy**. Depois escolha **Importar esta visão**.
3. **Conecte seu assistente.** No painel, copie o endereço `/mcp`, adicione-o ao ChatGPT ou Claude com OAuth e confirme a autorização.

| Campo do deploy | O que informar |
| --- | --- |
| `ADMIN_PASSWORD` | Uma senha pessoal de 16 a 256 caracteres. Guarde no seu gerenciador de senhas. |
| `PLUGGY_CLIENT_ID` | Client ID da sua aplicação no [painel Pluggy](https://dashboard.pluggy.ai/). |
| `PLUGGY_CLIENT_SECRET` | Client Secret da mesma aplicação. |

Conecte os bancos em [Meu Pluggy](https://meu.pluggy.ai/) antes de importá-los.
Os três valores ficam nos secrets da sua Cloudflare. Nenhuma chave técnica precisa
ser gerada manualmente. O painel permite cadastrar várias pessoas e perfis Pluggy autorizados. Consulte [pessoas e perfis](docs/household.md).

Instalações anteriores ao modelo mínimo exigem **banco novo**. A extensão de
planejamento aceita uma base que já usa `0001_initial.sql`, pelas migrações aditivas 0002, 0003 e 0004.
O botão usa o código publicado no GitHub; alterações locais não aparecem nele.
O provisionamento completo numa conta Cloudflare nova ainda exige validação real.
O software é gratuito; Cloudflare e Pluggy têm seus próprios limites e custos.

O MCP oferece 93 ferramentas: as quatro consultas/operações originais e 89
ferramentas de planejamento e organização, documentadas no
[catálogo financeiro](docs/mcp-finance.md). A importação lê contas, transações,
faturas, investimentos e empréstimos disponíveis na Pluggy. Categorias, tags,
regras, orçamento, metas, recorrências e lançamentos manuais ficam no D1.
Edições locais preservam os registros bancários. Escritas exigem confirmação e
chave de idempotência; o MCP não realiza pagamentos bancários.

A migração `0002_planning.sql` é aditiva sobre `0001_initial.sql` deste repositório.
Não é uma migração dos schemas históricos anteriores ao modelo mínimo.
Esta implementação permanece local até revisão e publicação autorizada.

Consulte o [guia de uso](docs/usage.md) para manutenção e recuperação de acesso.

## Desenvolvimento

Use Node 24, conforme `.nvmrc`, e instale pela raiz:

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run migrate:local
npm run dev
```

Antes de iniciar o servidor, preencha `.dev.vars` com valores sintéticos e uma
senha de 16 a 256 caracteres. Os testes usam fixtures e não precisam de contas bancárias.
`npm run build` prepara os assets e o dry-run do Worker; não publica o serviço.

[Contribuição e checks](CONTRIBUTING.md) · [Arquitetura](docs/adr-modular-monolith.md) ·
[Referência técnica](docs/cloudflare-product.md) · [Identidade visual](DESIGN.md)

O projeto usa a [licença MIT](LICENSE); código de terceiros mantém seus avisos.

O [painel da instalação](docs/frontend-workspace.md) reúne visão geral, transações, regras, grupos, sincronizações e conexões.
