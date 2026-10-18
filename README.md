# Caderninho

Seu MCP financeiro pessoal, instalado na sua conta Cloudflare. Conecte seus bancos
pelo Meu Pluggy e consulte o histórico no ChatGPT ou Claude.

## Começar

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho)

1. **Instale.** Clique no botão, confirme o nome do Worker e informe os três campos abaixo. Mantenha a raiz do repositório, build `npm run build` e deploy `npm run deploy`.
2. **Conecte seus bancos.** Abra `/account`, entre com sua senha e use **Abrir Meu Pluggy** para importar suas conexões pessoais.
3. **Conecte seu assistente.** No painel, copie o endereço `/mcp`, adicione-o ao ChatGPT ou Claude com OAuth e confirme a autorização.

| Campo do deploy | O que informar |
| --- | --- |
| `ADMIN_PASSWORD` | Uma senha pessoal de 16 a 256 caracteres. Guarde no seu gerenciador de senhas. |
| `PLUGGY_CLIENT_ID` | Client ID da sua aplicação no [painel Pluggy](https://dashboard.pluggy.ai/). |
| `PLUGGY_CLIENT_SECRET` | Client Secret da mesma aplicação. |

Conecte os bancos em [Meu Pluggy](https://meu.pluggy.ai/) antes de importá-los.
Os três valores ficam nos secrets da sua Cloudflare. Nenhuma chave técnica precisa
ser gerada manualmente. Uma pessoa e uma aplicação Pluggy usam cada instalação.

Esta versão exige **banco novo**. Não atualize uma instalação com o schema anterior.
O botão usa o código publicado no GitHub; alterações locais não aparecem nele.
O provisionamento completo numa conta Cloudflare nova ainda exige validação real.
O software é gratuito; Cloudflare e Pluggy têm seus próprios limites e custos.

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
