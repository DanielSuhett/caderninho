# Onboarding: pessoas, bancos e primeira importação

O produto incorpora a jornada aprovada na POC: cadastro de pessoa, credenciais
Pluggy na instalação, autorização de vários bancos e importação ao concluir
Pessoas. O formulário de instalação Cloudflare pede a senha de entrada antes do
deploy; os acessos Pluggy de ambiente continuam disponíveis para instalações
anteriores.

## Primeiro acesso

O botão Deploy to Cloudflare lê `.dev.vars.example` na raiz do repositório e
apresenta `ADMIN_PASSWORD` no formulário, com a descrição de `cloudflare.bindings`
em `package.json`. Esse arquivo declara somente a senha; Pluggy e o perfil são
configurados dentro do Caderninho depois de entrar. O dono escolhe de 16 a 256
caracteres e usa a mesma senha no endereço normal do aplicativo. Não precisa
procurar uma chave ou link de entrada nos logs.

O deploy confere os secrets existentes antes de migrar ou publicar. Preserva
`ADMIN_PASSWORD` e `ADMIN_ACCESS_HASH`, inclusive se o ambiente do build tiver
outra senha. Sem credencial existente, aceita `ADMIN_PASSWORD` pelo ambiente
privado do processo, valida o comprimento e envia via
`wrangler deploy --secrets-file` em arquivo temporário com modo 0600, removido ao
terminar ou falhar.
Sem senha válida, interrompe a instalação antes das migrações e da publicação.
A senha nunca é incluída nos argumentos de processo, logs ou URLs.

A declaração de secrets na raiz segue o [contrato oficial do botão
Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/#worker-environment-variables-and-secrets).
A senha informada ao botão deve chegar como secret do Worker; o ambiente privado
do processo é o caminho suportado para instalação por CLI. Erros de permissão e
respostas ambíguas do Wrangler interrompem o instalador sem substituir o acesso.

O login conserva origem, CSRF, limite de tentativas e OAuth separado. Não existe
rota pública para o primeiro visitante criar acesso administrativo. Uma instalação
incompleta continua fechada e mostra passos de recuperação com `ADMIN_PASSWORD`,
sem prometer um link inexistente. Reabrir preserva a autorização pendente do
assistente. Trocar a senha prevalece sobre a chave antiga e invalida sessões
anteriores, preservando os dados financeiros.

### Compatibilidade com chaves anteriores

Instalações anteriores com `ADMIN_ACCESS_HASH` continuam aceitando a chave
gerada. Seus links usam o fragmento `#access_key=`, que não é enviado na requisição
HTTP; o frontend remove o fragmento antes de mostrar ClipboardText e Começar.
Nenhum endpoint retorna a chave ou seu hash. Para recuperar acesso perdido,
o dono define `ADMIN_PASSWORD` nos secrets da Cloudflare.

Botões de navegação e ações compactas usam variantes nativas do Kumo, com bordas.
Caneta edita a pessoa, + autoriza outro banco e relógio abre o histórico daquele
banco. Logos vêm da identidade do provedor, com fallback quando indisponíveis.
Detalhes do modelo e do cofre estão em [Pessoas e bancos](household.md).

## Validação em 25/10/2026

| Superfície / estado | Resultado e evidência |
| --- | --- |
| Primeiro acesso e Pessoas | Acesso gerado revisado no Worker local: link privado, chave abreviada, remoção do fragmento e Começar autenticando até Nome e foto. Desktop e 391 CSS px, claro/escuro, sem overflow. A revisão anterior cobriu nome salvo no D1, credenciais, rascunho, nova pessoa e cancelamento. Fotos têm cobertura de contrato/persistência; upload não foi repetido. |
| Bancos e ações compactas | Alterados e revisados com dois bancos fictícios: logos carregados, indicadores, controles de 40 × 40 CSS px e bordas Kumo. Conferidos temas claro/escuro e largura estreita sem overflow. |
| Importar | Alterado e revisado com estados explícitos no D1 local: um banco concluído, outro em execução e avanço automático para Consultar ao concluir. Testes de integração cobrem admissão adiada, cron e pedidos repetidos; o runtime cobre execução e retomada de Workflows. |
| Consultar e histórico | Instruções ChatGPT/Claude revisadas, sem simular OAuth. O relógio abriu o histórico de uma conexão e retornou somente seu registro local. |
| Ajustes e demais páginas | Ajustes existentes preservados, com cópia atualizada; não receberam uma auditoria visual completa. As demais páginas não foram redesenhadas nesta entrega. As orientações globais estão em DESIGN.md e AGENTS.md. |

`mise run check` passou na versão final: tipos, lint, formatação, 101 testes Node,
169 testes de integração, build/dry-run e runtime nativo com 10 mil e 100 mil
registros, incluindo reinício da instalação. As fixtures não usam dados ou
credenciais bancárias pessoais.

Na revisão de 25/10, os testes do instalador usaram um executor Wrangler simulado:
cobriram geração, arquivo temporário com somente hash, preservação de acesso,
Worker ainda ausente, erro de permissão e falha de upload. A integração cobriu
chave válida, rejeição do hash como senha, invalidação de sessão e compatibilidade
com senha anterior.
ClipboardText foi configurado com a chave completa em `textToCopy` e mostrou
confirmação por teclado; o clipboard virtual do navegador de automação ficou
vazio, portanto seu conteúdo não foi confirmado nessa ferramenta.

Esta evidência comprova o código e os cenários locais descritos. A passagem visual
da importação usou estados preparados; não executou uma autorização Pluggy real.
Provisionamento em uma conta Cloudflare nova, consentimento no provedor e conexão
OAuth com um assistente real continuam sem validação ponta a ponta nesta entrega.
A publicação autorizada é do código no GitHub, sem deploy em instalação pessoal.

## Correção do primeiro acesso em 26/10/2026

O fluxo anterior não declarava um secret de entrada na raiz para o botão
Cloudflare. Dependia de uma chave no log do instalador, enquanto a página sem
configuração prometia um link privado sem comprovar que ele havia sido gerado.
A correção declara a senha no formulário inicial, interrompe o instalador sem
credencial e oferece recuperação explícita para instalações incompletas.

### Matriz de revisão local

O navegador colaborativo leu o HTML real de `accessPage`, renderizado com
fixtures e servido localmente. As capturas ficam em
`.wrangler/first-access-review-20261026/`, fora do Git, com índice `captures.json`.
O servidor dessas capturas é estático: autenticação, status HTTP e persistência
do destino de autorização são verificados pelos testes de integração do Worker.

| Página / estado | Resultado | Evidência e limite |
| --- | --- | --- |
| `/account/login`, senha configurada | Alterado e revisado | Cópia aponta para a senha escolhida na instalação. `login-{dark,light}-{1280,320}*`; Inter e controles de 16 px, URL longa sem overflow. |
| `/account/login`, instalação incompleta | Alterado e revisado | `recovery-{dark,light}-{1280,320}`. Passos numerados, destino Cloudflare e ação de retorno. Tab alcança os links e o botão com ring de foco nativo. Integração cobre 503, API fechada, recusa de criação pública de senha e retorno OAuth preservado. |
| `/account/login`, senha inválida | Revisado, sem mudança necessária no erro | `error-{dark,light}-{1280,320}`. Banner, `aria-invalid` e `aria-describedby` preservados; sem rolagem horizontal a 320 CSS px. |
| `/account/login`, esqueci minha senha | Revisado, sem mudança necessária | Capturas `login-*-expanded`. Ajuda abre por Enter e fecha pelo mesmo summary; formulário e foco continuam disponíveis. |
| `/account/login?returnTo=/authorize…` | Revisado, sem mudança necessária na autorização | Desktop escuro e 320 CSS px claro; `authorization-light-320`. Rótulo “Entrar e continuar” e destino oculto preservados. Consentimento real com assistente não repetido. |
| `/account/login`, chave de instalação anterior | Revisado, sem mudança necessária | Campo de chave e carregamento de `access.js` conferidos em desktop escuro. Integração cobre chave válida, rejeição do hash, troca de chave e precedência da senha. Clipboard antigo não foi repetido. |
| Entrada e recuperação ampliadas | Revisado com limite | `login-{light,dark}-zoom200` e `recovery-{light,dark}-zoom200`. Zoom CSS de 200%, sem overflow horizontal a 1280 px; não equivale a uma auditoria de zoom nativo ou de leitor de tela. |
| Limite de tentativas e sessão expirada | Sem mudança necessária; não revalidados visualmente | Contratos de autenticação preservados e cobertos pela suíte existente. A revisão visual desta correção cobre erro de senha e configuração ausente. |
| Formulário do botão Cloudflare e primeiro deploy remoto | Alterado, não validado no serviço real | `.dev.vars.example` e descrição em `package.json` seguem a documentação oficial. Testes do instalador usam executor Wrangler simulado e senha sintética; não comprovam o provisionamento remoto. |
| Pessoas, Pluggy, importação e demo | Sem mudança necessária nesta correção; não revalidados visualmente | Não receberam alterações. A revisão é local ao acesso; não é uma auditoria global nem uma autorização Pluggy real. |

Os testes do instalador cobrem senha fornecida pelo ambiente, secret já criado
pelo formulário, preservação de acesso mesmo com outra senha no build, credencial
ausente ou inválida antes de migrar/publicar, erro de permissão, resposta
malformada, falha de upload e remoção do arquivo temporário. As capturas e testes
usam somente dados sintéticos. Nenhum deploy ou migração remota foi executado.

`mise run check` passou: tipos gerados, TypeScript, formatação, lint, 122 testes
Node, 178 testes de integração, build/dry-run e runtime local com 10 mil e 100 mil
registros e reinício persistente. `check:quick`, `lint:fix`, `format` e o diagnóstico
Ultracite também passaram. O log final fica junto das capturas em `check.log`.
