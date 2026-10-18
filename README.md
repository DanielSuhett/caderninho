# Caderninho

Servidor MCP instalável na conta Cloudflare do usuário, com base financeira D1,
execução durável por Workflows, OAuth e regras determinísticas.

A landing apresenta o projeto e abre o botão Cloudflare diretamente. `/account` é o painel
privado: verifica instalação, valida Pluggy, conecta bancos, acompanha a cópia e
confirma requisições do assistente. A interface usa Kumo. O acesso pode usar uma
chave administrativa provisionada pelo dono; instalações GitHub são preservadas.
ChatGPT e Claude se conectam por OAuth, com autorização separada do login no painel.

O Worker está em `src/worker`; a configuração de produção é `wrangler.jsonc` na
raiz. Dentro do Worker, abra o módulo da funcionalidade: `account`, `auth`,
`finance`, `sync` ou `mcp`. Controllers recebem chamadas, services coordenam as
ações e repositories concentram a persistência, usando funções e dependências
explícitas. Os módulos compartilhados de domínio ficam em `src/domain`.

Leia [instalação e limites](docs/cloudflare-product.md) e
[a arquitetura](docs/adr-modular-monolith.md).

## Instale na sua Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho)

1. Clique em **Deploy to Cloudflare**. O formulário da Cloudflare permite configurar o projeto, os recursos e as secrets.
2. Preencha `OWNER_ID`, `PUBLIC_ORIGIN`, `ADMIN_KEY_SHA256`, `CREDENTIAL_KEY` e `WEBHOOK_SECRET` com seus próprios valores. Confirme o nome do Worker e mantenha a raiz do repositório e os comandos `npm run build` / `npm run deploy`.
3. Após o deploy, abra `/account`, entre com sua **chave administrativa** e conecte sua Pluggy pelo painel. Use `/mcp` no seu assistente.

A instalação usa o formulário nativo da Cloudflare. Configure estes cinco campos:

| Campo | Valor exigido |
| --- | --- |
| `OWNER_ID` | UUID exclusivo desta instalação. Exemplo de comando: `node -p 'crypto.randomUUID()'`. |
| `PUBLIC_ORIGIN` | Origem HTTPS exata do Worker, sem caminho, parâmetros ou fragmento. |
| `ADMIN_KEY_SHA256` | SHA-256 em hexadecimal de uma chave administrativa aleatória de 64 caracteres hexadecimais. |
| `CREDENTIAL_KEY` | 32 bytes aleatórios em base64: `openssl rand -base64 32`. |
| `WEBHOOK_SECRET` | Secret aleatório independente: `openssl rand -hex 32`. |

Para a chave administrativa, use `openssl rand -hex 32` e guarde o resultado em
um gerenciador de senhas. No Bash, calcule o hash sem colocar a chave no histórico:

```sh
read -r -s -p 'Chave administrativa: ' CADERNINHO_ADMIN_KEY
printf '\n'
printf '%s' "$CADERNINHO_ADMIN_KEY" | openssl dgst -sha256
unset CADERNINHO_ADMIN_KEY
```

Cole apenas os 64 caracteres hexadecimais do hash em `ADMIN_KEY_SHA256`.
A chave original abre `/account`; o hash não serve para entrar.
Forneça os valores diretamente à sua Cloudflare. Preserve `OWNER_ID` e
`CREDENTIAL_KEY` nas atualizações. GitHub OAuth é opcional; não cadastre credenciais
Pluggy globais no Worker. O software é gratuito; Cloudflare e Pluggy têm seus próprios
limites e custos.

Compartilhe o repositório, sem secrets ou dados financeiros. O botão usa a versão
publicada da origem, não alterações locais. A instalação em uma conta Cloudflare
nova ainda precisa validar isolamento de recursos e o primeiro deploy; veja a
[lista no guia](docs/cloudflare-product.md#pendências-antes-de-recomendar-instalações-de-terceiros).
URLs de preview Cloudflare estão desabilitadas nesta configuração.

### Recuperar acesso

Crie outra chave administrativa de 64 caracteres hexadecimais e calcule seu hash
pelo procedimento acima. Na sua conta Cloudflare, substitua somente `ADMIN_KEY_SHA256`.
As sessões administrativas existentes expiram. Preserve `OWNER_ID` ou `OWNER_GITHUB_ID`
e `CREDENTIAL_KEY`: trocar esses valores pode separar a identidade ou impedir o acesso
ao cofre. Autorizações MCP são revogadas separadamente no painel.

## Desenvolvimento

Use a linha Node 24 indicada por `.nvmrc` e instale pela raiz:

```sh
npm ci
npm run dev
```

`npm run dev` prepara os assets e inicia o Worker local. `npm run build` gera assets
em `dist/web` e faz dry-run do Worker em `dist/worker`; não publica o serviço.
Um único `tsconfig.json` verifica fontes, scripts e testes.

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para os checks e convenções,
[a arquitetura](docs/adr-modular-monolith.md) para navegar pelo código e
[DESIGN.md](DESIGN.md) para a identidade visual. Os testes usam dados sintéticos;
checks locais não substituem a validação de deploy, OAuth e cliente MCP reais.

A ajuda por IA oferece diagnóstico seguro copiável e `caderninho_setup_status`.
O projeto usa a [licença MIT](LICENSE); código de terceiros mantém seus avisos.
