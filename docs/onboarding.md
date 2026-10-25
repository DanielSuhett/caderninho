# Onboarding: pessoas, bancos e primeira importação

O produto incorpora a jornada aprovada na POC: cadastro de pessoa, credenciais
Pluggy na instalação, autorização de vários bancos e importação ao concluir
Pessoas. A instalação Cloudflare solicita apenas `ADMIN_PASSWORD`; os acessos
Pluggy de ambiente continuam disponíveis para instalações anteriores.

Botões de navegação e ações compactas usam variantes nativas do Kumo, com bordas.
Caneta edita a pessoa, + autoriza outro banco e relógio abre o histórico daquele
banco. Logos vêm da identidade do provedor, com fallback quando indisponíveis.
Detalhes do modelo e do cofre estão em [Pessoas e bancos](household.md).

## Validação em 25/10/2026

| Superfície / estado | Resultado e evidência |
| --- | --- |
| Primeiro acesso e Pessoas | Alterados e revisados no Worker local isolado: nome salvo no D1, formulário de credenciais, proteção de rascunho, nova pessoa e cancelamento. Fotos são cobertas pelo teste de contrato/persistência; o upload não foi repetido nesta revisão visual. |
| Bancos e ações compactas | Alterados e revisados com dois bancos fictícios: logos carregados, indicadores, controles de 40 × 40 CSS px e bordas Kumo. Conferidos temas claro/escuro e largura estreita sem overflow. |
| Importar | Alterado e revisado com estados explícitos no D1 local: um banco concluído, outro em execução e avanço automático para Consultar ao concluir. Testes de integração cobrem admissão adiada, cron e pedidos repetidos; o runtime cobre execução e retomada de Workflows. |
| Consultar e histórico | Instruções ChatGPT/Claude revisadas, sem simular OAuth. O relógio abriu o histórico de uma conexão e retornou somente seu registro local. |
| Ajustes e demais páginas | Ajustes existentes preservados, com cópia atualizada; não receberam uma auditoria visual completa. As demais páginas não foram redesenhadas nesta entrega. As orientações globais estão em DESIGN.md e AGENTS.md. |

`mise run check` passou na versão final: tipos, lint, formatação, 97 testes Node,
167 testes de integração, build/dry-run e runtime nativo com 10 mil e 100 mil
registros, incluindo reinício da instalação. As fixtures não usam dados ou
credenciais bancárias pessoais.

Esta evidência comprova o código e os cenários locais descritos. A passagem visual
da importação usou estados preparados; não executou uma autorização Pluggy real.
Provisionamento em uma conta Cloudflare nova, consentimento no provedor e conexão
OAuth com um assistente real continuam sem validação ponta a ponta nesta entrega.
A publicação autorizada é do código no GitHub, sem deploy em instalação pessoal.
