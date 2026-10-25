# Onboarding: pessoas, bancos e primeira importação

O produto incorpora a jornada aprovada na POC: cadastro de pessoa, credenciais
Pluggy na instalação, autorização de vários bancos e importação ao concluir
Pessoas. A instalação Cloudflare gera a chave de acesso, sem pedir senha; os acessos
Pluggy de ambiente continuam disponíveis para instalações anteriores.

## Acesso gerado

O instalador gera 32 bytes aleatórios e publica somente o hash da chave como
secret `ADMIN_ACCESS_HASH`, junto do código via `wrangler deploy --secrets-file`.
A conferência de secrets preserva chaves e senhas existentes; respostas ambíguas
ou erros de permissão interrompem o processo. Não há uma rota pública que entregue
ou crie acesso administrativo para o primeiro visitante.

Após o deploy bem-sucedido, seu log privado mostra o link de entrada com a chave
no fragmento `#access_key=`. O fragmento não é enviado na requisição HTTP e o
frontend o remove do endereço antes de mostrar ClipboardText. A chave permanece
somente na memória da página até a entrada; a cópia usa o valor completo, com
exibição abreviada. Nenhum endpoint retorna a chave ou o hash.

Começar usa o login existente, com origem, CSRF e limite de tentativas. A chave
abre o painel e permite revisar consentimentos; assistentes continuam usando
OAuth, sem ganhar uma chave administrativa de API. Para recuperar acesso perdido,
o dono pode definir `ADMIN_PASSWORD` nos secrets da Cloudflare; ele prevalece
sobre o hash e invalida as sessões anteriores.

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

Os testes do instalador usam um executor Wrangler simulado: cobrem geração,
arquivo temporário com somente hash, preservação de acesso, Worker ainda ausente,
erro de permissão e falha de upload. A integração cobre chave válida, rejeição
do hash como senha, invalidação de sessão e compatibilidade com senha anterior.
ClipboardText foi configurado com a chave completa em `textToCopy` e mostrou
confirmação por teclado; o clipboard virtual do navegador de automação ficou
vazio, portanto seu conteúdo não foi confirmado nessa ferramenta.

Esta evidência comprova o código e os cenários locais descritos. A passagem visual
da importação usou estados preparados; não executou uma autorização Pluggy real.
Provisionamento em uma conta Cloudflare nova, consentimento no provedor e conexão
OAuth com um assistente real continuam sem validação ponta a ponta nesta entrega.
A publicação autorizada é do código no GitHub, sem deploy em instalação pessoal.
